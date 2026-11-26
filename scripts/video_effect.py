"""Aplique um efeito editorial a um vídeo com configuração JSON."""
import argparse
import json
import math
from pathlib import Path
import subprocess
from PIL import Image, ImageDraw, ImageFont, ImageOps

EFFECTS = ("documentario","orbita","linha-do-tempo","holofote","tela-dividida","vidro","checklist")


def decorate(frame, effect, cfg, t, duration, asset, font):
    original = frame.copy()
    w,h = frame.size
    overlay = Image.new("RGBA",frame.size)
    draw = ImageDraw.Draw(overlay)
    x,y = cfg.get("position",[.5,.5])
    points = cfg.get("keyframes",[])
    if points:
        left = max((p for p in points if p[0]<=t),default=points[0])
        right = min((p for p in points if p[0]>=t),default=points[-1])
        mix = (t-left[0])/(right[0]-left[0]) if right[0]>left[0] else 0
        x,y = [left[i]+mix*(right[i]-left[i]) for i in (1,2)]
    x,y = int(x*w),int(y*h)
    color = cfg.get("color","#80d8ce")
    labels = cfg.get("labels",[])
    strength = max(0,min(1,float(cfg.get("intensity",.8))))
    progress = max(0,min(.99999,t/duration))
    step = int(progress*len(labels))
    if effect == "documentario":
        frame = Image.blend(frame,ImageOps.grayscale(frame).convert("RGB"),strength)
        for j in range(0,h,8):
            for i in range(j%3,w,8):
                draw.point((i,j),fill=(30,30,30,35))
    elif effect == "orbita":
        for i,label in enumerate(labels):
            angle = math.tau*(progress+i/len(labels))
            px,py = x+math.cos(angle)*w*.29,y+math.sin(angle)*h*.19
            draw.text((px,py),label,font=font,anchor="mm",fill=color,stroke_width=2,stroke_fill="#142532")
    elif effect == "holofote":
        draw.rectangle((0,0,w,h),fill=(0,0,0,round(155*strength)))
        draw.ellipse((x-w*.19,y-h*.30,x+w*.19,y+h*.30),fill=(0,0,0,0))
    elif effect == "tela-dividida":
        frame.paste(ImageOps.fit(frame,(w//2,h)),(0,0))
        frame.paste(ImageOps.fit(asset,(w-w//2,h)),(w//2,0))
    elif effect == "vidro":
        draw.rounded_rectangle((x-w*.32,y-h*.15,x+w*.32,y+h*.15),radius=14,fill=(25,50,62,round(160*strength)),outline=color,width=2)
    elif effect == "linha-do-tempo":
        draw.line((x-w*.34,y,x+w*.34,y),fill="white",width=3)
        for i,label in enumerate(labels):
            px = x-w*.34+w*.68*i/max(1,len(labels)-1)
            draw.ellipse((px-6,y-6,px+6,y+6),fill=color if i<=step else "#657688")
    elif effect == "checklist":
        for i,label in enumerate(labels):
            draw.text((x,y+(i-(len(labels)-1)/2)*h*.085),("[x] " if i<=step else "[ ] ")+label,font=font,anchor="mm",fill=color,stroke_width=2,stroke_fill="black")
    if labels and effect in ("vidro","documentario","linha-do-tempo"):
        draw.text((x,y+h*.055),labels[step],font=font,anchor="mm",fill="white",stroke_width=2,stroke_fill="#203040")
    result = Image.alpha_composite(frame.convert("RGBA"),overlay).convert("RGB")
    return Image.blend(original,result,strength)


def apply(source,out,effect,cfg):
    probe = subprocess.check_output(["ffprobe","-v","error","-select_streams","v:0","-show_entries","stream=width,height:format=duration","-of","json",str(source)])
    info = json.loads(probe)
    stream = info["streams"][0]
    w,h = stream["width"],stream["height"]
    duration = float(cfg.get("duration",info["format"]["duration"]))
    start = float(cfg.get("start",0))
    if duration<=0 or start<0 or out.exists():
        raise ValueError("Confira o intervalo e escolha uma saída nova.")
    if effect in ("orbita","linha-do-tempo","checklist","vidro") and not cfg.get("labels"):
        raise ValueError("Forneça labels para o conteúdo do efeito.")
    asset = Image.open(cfg["image"]).convert("RGB") if effect=="tela-dividida" else None
    size = max(12,int(min(w,h)*.038))
    font = ImageFont.truetype(cfg["font"],size) if cfg.get("font") else ImageFont.load_default(size=size)
    fps = int(cfg.get("fps",30))
    if not 1<=fps<=120:
        raise ValueError("FPS fora do intervalo 1–120.")
    with subprocess.Popen(["ffmpeg","-v","error","-noautorotate","-i",str(source),"-map","0:v:0","-vf",f"fps={fps}","-f","rawvideo","-pix_fmt","rgb24","-"],stdout=subprocess.PIPE) as reader, subprocess.Popen(["ffmpeg","-v","error","-n","-f","rawvideo","-s",f"{w}x{h}","-pix_fmt","rgb24","-r",str(fps),"-i","-","-i",str(source),"-map","0:v","-map","1:a:0?","-c:v","libx264","-vf","pad=ceil(iw/2)*2:ceil(ih/2)*2","-pix_fmt","yuv420p","-c:a","aac",str(out)],stdin=subprocess.PIPE) as writer:
        i = 0
        while block := reader.stdout.read(3*w*h):
            t = i/fps-start
            if 0<=t<duration:
                block = decorate(Image.frombytes("RGB",(w,h),block),effect,cfg,t,duration,asset,font).tobytes()
            writer.stdin.write(block)
            i += 1
        writer.stdin.close()
        if reader.wait() or writer.wait() or not i:
            raise RuntimeError("Falha na conversão do vídeo.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("effect",choices=EFFECTS)
    parser.add_argument("source",type=Path)
    parser.add_argument("out",type=Path)
    parser.add_argument("config",type=Path)
    args = parser.parse_args()
    apply(args.source,args.out,args.effect,json.loads(args.config.read_text(encoding="utf-8")))
