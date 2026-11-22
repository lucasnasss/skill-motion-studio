# Uso do Motion Studio Pro 2.0

Execute os comandos na pasta da skill. O formato v2 mantém cenas e uma timeline JSON comum a CREATE, EDIT e HYBRID.

## Criar e renderizar

```powershell
npm ci
npm run doctor
node scripts/motion-studio.mjs validate examples/pro2-a-create-vertical.json
node scripts/motion-studio.mjs pipeline examples/pro2-a-create-vertical.json --out output/video.mp4
```

`new --prompt "..." --out projeto.json` cria somente um rascunho. Refine roteiro, mídias e cenas antes do render. `pipeline` produz prévia, quadros, SRT, MP4, relatório FFprobe e relatório de qualidade.

## Editar uma gravação

```powershell
node scripts/motion-studio.mjs analyze entrada.mp4 --out output/analise.json
node scripts/motion-studio.mjs edit-plan entrada.mp4 --out projeto-edit.json --intensity dynamic --aspect 9:16
node scripts/motion-studio.mjs edit entrada.mp4 --out output/editado.mp4 --project projeto-edit.json --intensity dynamic --aspect 9:16
```

Intensidades: `conservative` preserva o ritmo natural; `dynamic` reduz pausas e prepara conteúdo social; `editorial` usa cortes mais firmes e requer maior revisão. O arquivo de entrada nunca é sobrescrito. Detecção de silêncio não compreende intenção ou erros de fala.

## Áudio e legendas

```powershell
node scripts/motion-studio.mjs tts projeto.json --out projeto-com-voz.json --sync
node scripts/motion-studio.mjs srt projeto-com-voz.json --out output/legendas.srt
python scripts/transcribe.py entrada.mp4 --out output/transcricao.json --language pt
```

O TTS incluído usa vozes OneCore no Windows. `faster-whisper` é opcional e deve ser instalado em ambiente Python isolado para usar `transcribe.py`. Cues aceitam timestamps de palavras e estilos `traditional`, `highlight` e `karaoke`.

## 3D e cenas reutilizáveis

Elementos `three` suportam primitivas, modelos GLB/GLTF, materiais, sombras, luz e câmera animada por frame. O adaptador Blender opcional fica em `scripts/blender/render_scene.py`.

```powershell
node scripts/motion-studio.mjs scene-library
node scripts/motion-studio.mjs scene-library science-demo --title "Como funciona?" --out minha-cena.json
```

A biblioteca contém 12 layouts parametrizáveis. Copie a cena gerada para `scenes[]` e ajuste texto, cores, duração, mídias e animação.

## Qualidade e lote

```powershell
node scripts/motion-studio.mjs quality projeto.json output/final.mp4
node scripts/batch-manager.mjs run examples/batch-test.json
node scripts/batch-manager.mjs status examples/batch-test.json
node scripts/batch-manager.mjs cancel examples/batch-test.json
```

O lote persiste progresso e logs, aceita retomada/tentativas e limita concorrência. Use `--concurrency` no render para controlar CPU/RAM.

## Comandos completos

`doctor`, `new`, `validate`, `preview`, `frames`, `render`, `verify`, `quality`, `srt`, `tts`, `pipeline`, `analyze`, `edit-plan`, `edit` e `scene-library`. Execute `node scripts/motion-studio.mjs help` para opções.
