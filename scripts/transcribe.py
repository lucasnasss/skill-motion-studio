"""Adaptador opcional de transcrição local com faster-whisper."""
from __future__ import annotations
import argparse
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Transcreve áudio/vídeo com timestamps de palavras.")
    parser.add_argument("input")
    parser.add_argument("--out", required=True)
    parser.add_argument("--model", default="small")
    parser.add_argument("--language", default="pt")
    parser.add_argument("--device", default="cpu")
    args = parser.parse_args()
    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise SystemExit("faster-whisper não está instalado. Instale-o em um ambiente Python isolado.") from exc
    model = WhisperModel(args.model, device=args.device, compute_type="int8" if args.device == "cpu" else "float16")
    segments, info = model.transcribe(args.input, language=args.language, word_timestamps=True, vad_filter=True)
    result = {"language": info.language, "duration": info.duration, "segments": []}
    for index, segment in enumerate(segments):
        result["segments"].append({
            "id": f"caption-{index + 1}", "startSeconds": segment.start,
            "endSeconds": segment.end, "text": segment.text.strip(),
            "words": [{"text": word.word.strip(), "startSeconds": word.start, "endSeconds": word.end}
                      for word in (segment.words or []) if word.word.strip()],
        })
    target = Path(args.out)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(target.resolve())


if __name__ == "__main__":
    main()
