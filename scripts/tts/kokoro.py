"""Adaptador local Kokoro. Instale em Python 3.10–3.13: kokoro==0.9.4 soundfile."""
from __future__ import annotations
import argparse
from pathlib import Path

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--text', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--voice', default='pf_dora')
    parser.add_argument('--speed', type=float, default=1.0)
    parser.add_argument('--language', default='p')
    args = parser.parse_args()
    try:
        import numpy as np
        import soundfile as sf
        from kokoro import KPipeline
    except ImportError as exc:
        raise SystemExit('Kokoro indisponível. Use Python 3.10–3.13 e instale kokoro==0.9.4 soundfile; pt-BR também requer espeak-ng.') from exc
    pipeline = KPipeline(lang_code=args.language)
    chunks = [audio for _, _, audio in pipeline(args.text, voice=args.voice, speed=args.speed)]
    if not chunks:
        raise SystemExit('Kokoro não produziu áudio.')
    target = Path(args.out); target.parent.mkdir(parents=True, exist_ok=True)
    sf.write(target, np.concatenate(chunks), 24000, subtype='PCM_16')
    print(target.resolve())

if __name__ == '__main__':
    main()
