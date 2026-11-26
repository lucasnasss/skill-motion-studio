"""Anime um avatar desenhado usando um ponto de boca calibrado e narração local."""
import argparse
import math
from pathlib import Path
import subprocess
import wave
from array import array
from tempfile import TemporaryDirectory
from PIL import Image, ImageDraw, ImageOps


def animate(image_file, audio, out, mouth, width):
    if out.exists() or out.suffix.lower() != ".mp4":
        raise ValueError("Escolha um MP4 de saída novo.")
    with Image.open(image_file) as original:
        base = ImageOps.exif_transpose(original).convert("RGBA")
    base.thumbnail((720,720))
    canvas = Image.new("RGB",(720,720),"#edf2f1")
    canvas.paste(base,((720-base.width)//2,(720-base.height)//2),base)
    x = (720-base.width)/2+mouth[0]*base.width
    y = (720-base.height)/2+mouth[1]*base.height
    radius = width*base.width/2
    with TemporaryDirectory() as temp:
        wav = Path(temp)/"analysis.wav"
        subprocess.run(["ffmpeg","-v","error","-i",str(audio),"-vn","-ac","1","-ar","24000","-c:a","pcm_s16le",str(wav)],check=True)
        with wave.open(str(wav)) as speech, subprocess.Popen(["ffmpeg","-v","error","-n","-f","rawvideo","-pix_fmt","rgb24","-s","720x720","-r","30","-i","-","-i",str(audio),"-map","0:v","-map","1:a:0","-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac","-shortest",str(out)],stdin=subprocess.PIPE) as proc:
            envelope = 0
            while block := speech.readframes(800):
                samples = array("h",block)
                rms = math.sqrt(sum(v*v for v in samples)/len(samples))
                envelope = .35*envelope+.65*min(1,rms/4000)
                frame = canvas.copy()
                height = max(1,radius*.65*envelope)
                ImageDraw.Draw(frame).ellipse((x-radius,y-height,x+radius,y+height),fill="#482936")
                proc.stdin.write(frame.tobytes())
            proc.stdin.close()
            if proc.wait():
                raise RuntimeError("Falha ao montar vídeo com a narração.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("avatar",type=Path)
    parser.add_argument("audio",type=Path)
    parser.add_argument("output",type=Path)
    parser.add_argument("--mouth",nargs=2,type=float,required=True,metavar=("X","Y"))
    parser.add_argument("--width",type=float,default=.14)
    args = parser.parse_args()
    if not all(0 <= v <= 1 for v in args.mouth) or not 0 < args.width <= 1:
        parser.error("Use coordenadas e largura relativas à imagem, entre 0 e 1.")
    animate(args.avatar,args.audio,args.output,args.mouth,args.width)
