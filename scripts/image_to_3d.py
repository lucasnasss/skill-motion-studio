"""Reconstrua um baixo-relevo colorido da vista frontal de um PNG recortado."""
import argparse
import json
import math
from pathlib import Path
import struct
import subprocess
from PIL import Image, ImageDraw, ImageOps


def cutout(source):
    with Image.open(source) as original:
        image = ImageOps.exif_transpose(original).convert("RGBA")
    mask = image.getchannel("A").point(lambda a: 255 if a >= 128 else 0)
    if mask.getextrema() != (0, 255):
        raise ValueError("Use um PNG com objeto recortado e fundo transparente.")
    return image.crop(mask.getbbox())


def geometry(source, resolution, depth, side=None):
    image = cutout(source)
    image.thumbnail((resolution, resolution), Image.Resampling.LANCZOS)
    w, h = image.size
    scale = 2 / max(w, h)
    pixels = {(x, y): image.getpixel((x, y))[:3] for y in range(h)
              for x in range(w) if image.getpixel((x, y))[3] >= 128}
    if not pixels:
        raise ValueError("Objeto vazio na resolução escolhida.")
    if side:
        profile = cutout(side)
        n = max(1,min(resolution,round(h*profile.width/profile.height)))
        profile = profile.resize((n,h),Image.Resampling.LANCZOS)
        occupied = {(x,y,z) for x,y in pixels for z in range(n) if profile.getpixel((z,y))[3]>=128}
        if not occupied:
            raise ValueError("As silhuetas não se intersectam.")
        for x,y,z in sorted(occupied):
            left,top,near = (x-w/2)*scale,(h/2-y)*scale,(z-n/2)*scale
            a=(left,top,near)
            b=(left+scale,top,near)
            c=(left+scale,top-scale,near)
            d=(left,top-scale,near)
            e,f,g,k=[(u,v,q+scale) for u,v,q in (a,b,c,d)]
            for (i,j,l), face in (((0,0,-1),(a,b,c,d)),((0,0,1),(k,g,f,e)),
                                   ((0,-1,0),(e,f,b,a)),((0,1,0),(d,c,g,k)),
                                   ((-1,0,0),(a,d,k,e)),((1,0,0),(f,g,c,b))):
                if (x+i,y+j,z+l) not in occupied:
                    yield face,pixels[x,y]
        return
    for (x, y), color in pixels.items():
        l, t = (x-w/2)*scale, (h/2-y)*scale
        r, b = l+scale, t-scale
        f, k = depth/2, -depth/2
        front = [(l,b,f),(r,b,f),(r,t,f),(l,t,f)]
        back = [(u,v,k) for u,v,_ in front]
        yield front, color
        yield back[::-1], color
        for i, offset in enumerate([(0,1),(1,0),(0,-1),(-1,0)]):
            if (x+offset[0], y+offset[1]) not in pixels:
                j = (i+1)%4
                yield [front[j],front[i],back[i],back[j]], color


def export_glb(faces, target):
    pos, colors = bytearray(), bytearray()
    low, high = [math.inf]*3, [-math.inf]*3
    for quad, rgb in faces:
        for i in (0,1,2,0,2,3):
            p = quad[i]
            pos.extend(struct.pack("<3f", *p))
            colors.extend(bytes((*rgb,255)))
            for axis, value in enumerate(p):
                low[axis] = min(low[axis],value)
                high[axis] = max(high[axis],value)
    blob = pos+colors
    count = len(pos)//12
    doc = {"asset":{"version":"2.0","generator":"Motion Studio"},
           "scene":0,"scenes":[{"nodes":[0]}],"nodes":[{"mesh":0}],
           "meshes":[{"primitives":[{"attributes":{"POSITION":0,"COLOR_0":1},"material":0}]}],
           "materials":[{"pbrMetallicRoughness":{"metallicFactor":0,"roughnessFactor":1}}],
           "buffers":[{"byteLength":len(blob)}],
           "bufferViews":[{"buffer":0,"byteLength":len(pos)},{"buffer":0,"byteOffset":len(pos),"byteLength":len(colors)}],
           "accessors":[{"bufferView":0,"componentType":5126,"count":count,"type":"VEC3","min":low,"max":high},
                        {"bufferView":1,"componentType":5121,"count":count,"type":"VEC4","normalized":True}]}
    meta = json.dumps(doc).encode()
    meta += b" "*(-len(meta)%4)
    with target.open("xb") as out:
        out.write(struct.pack("<4sIII4s",b"glTF",2,28+len(meta)+len(blob),len(meta),b"JSON"))
        out.write(meta+struct.pack("<I4s",len(blob),b"BIN\0")+blob)


def render(faces, angle):
    c,s = math.cos(angle), math.sin(angle)
    image = Image.new("RGB",(384,384),"#202635")
    draw = ImageDraw.Draw(image)
    projected = []
    for quad,rgb in faces:
        pts = [(c*x+s*z,y,c*z-s*x) for x,y,z in quad]
        projected.append((sum(p[2] for p in pts),[(192+145*x,192-145*y) for x,y,_ in pts],rgb))
    for _,points,color in sorted(projected,key=lambda p:p[0]):
        draw.polygon(points,fill=color)
    return image


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("reference",type=Path)
    parser.add_argument("output",type=Path)
    parser.add_argument("--resolution",type=int,default=48,choices=range(8,129),metavar="8..128")
    parser.add_argument("--depth",type=float,default=0.24)
    parser.add_argument("--video",action="store_true")
    parser.add_argument("--side",type=Path,help="Vista lateral ortogonal recortada, alinhada verticalmente à frontal.")
    args = parser.parse_args()
    if not 0 < args.depth <= 2:
        parser.error("Profundidade deve estar em (0, 2].")
    faces = list(geometry(args.reference,args.resolution,args.depth,args.side))
    args.output.mkdir(parents=True,exist_ok=False)
    export_glb(faces,args.output/"modelo.glb")
    for i, angle in enumerate((0,0.7,1.3)):
        render(faces,angle).save(args.output/f"vista-{i}.png")
    if args.video:
        with subprocess.Popen(["ffmpeg","-v","error","-f","rawvideo","-pix_fmt","rgb24","-s","384x384","-r","30","-i","-","-c:v","libx264","-pix_fmt","yuv420p",str(args.output/"modelo.mp4")],stdin=subprocess.PIPE) as process:
            for frame in range(90):
                process.stdin.write(render(faces,math.tau*frame/90).tobytes())
            process.stdin.close()
            if process.wait():
                raise RuntimeError("FFmpeg falhou.")
    (args.output/"metadata.json").write_text(json.dumps({"reference":str(args.reference.resolve()),
        "side":str(args.side.resolve()) if args.side else None,
        "method":"visual-hull" if args.side else "extruded-silhouette","observed":"silhuetas fornecidas e cores frontais",
        "inferred":"interseção de projeções ortogonais" if args.side else "profundidade uniforme, cores repetidas no verso",
        "depth":None if args.side else args.depth,"triangles":2*len(faces)},ensure_ascii=False,indent=2),encoding="utf-8")


if __name__ == "__main__":
    main()
