"""Adaptador opcional para uma instalação e pesos locais Hunyuan3D-Shape 2.1."""
import argparse
import os
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image",type=Path)
    parser.add_argument("weights",type=Path)
    parser.add_argument("output",type=Path)
    args = parser.parse_args()
    if not args.image.is_file() or not args.weights.is_dir():
        parser.error("Informe a imagem e o diretório dos pesos já instalados.")
    if args.output.suffix.lower()!=".glb" or args.output.exists():
        parser.error("Informe uma saída GLB nova.")
    os.environ["HF_HUB_OFFLINE"]="1"
    from hy3dshape.pipelines import Hunyuan3DDiTFlowMatchingPipeline
    from PIL import Image
    pipeline = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(str(args.weights.resolve()),subfolder="hunyuan3d-dit-v2-1")
    with Image.open(args.image) as image:
        mesh = pipeline(image=image.convert("RGBA"))[0]
    if mesh.is_empty:
        raise ValueError("O modelo produziu uma malha vazia.")
    with args.output.open("xb") as out:
        out.write(mesh.export(file_type="glb"))


if __name__ == "__main__":
    main()
