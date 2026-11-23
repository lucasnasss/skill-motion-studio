# Relatório técnico — Motion Studio Pro 2.0

Data: 22 de novembro de 2026  
Ambiente: Windows x64, Node.js 22, Remotion 4.0.545, React 19.3.1, Three.js 0.171.0

## Resultado reproduzível

- Testes Node: 15/15 aprovados; TypeScript sem erros.
- Esquema v2, timeline, segurança de caminhos, SRT temporizado, editor, 3D e Quality Inspector cobertos por testes.
- Teste A: CREATE vertical de 30 s com WAV local, captions, prévia, 15 quadros, SRT, MP4 e FFprobe aprovados.
- Teste B: 3D integrado de 15 s com material físico, luz, sombra e câmera; MP4 e inspeção visual aprovados.
- Teste C: pipeline EDIT exercitado com vídeo local narrado; cinco trechos, 30,0 → 22,167 s, original preservado, prévia/15 quadros/MP4 aprovados. É proxy técnico, não gravação talking head.
- Teste D: Toy 3D de 12 s renderizado em MP4.
- Teste E: três jobs em lote concluídos com persistência, concorrência 2 e logs individuais.
- Teste F: vídeo 1920×1080 de 8 s para incorporação em PowerPoint, com prévia, quadros, MP4 e FFprobe aprovados.

Arquivos de teste ficam em `examples/pro2-*.json`; o projeto C é gerado localmente a partir da mídia autorizada e fica ignorado junto com `public/imports/`. Artefatos de render ficam em `output/` e não são versionados no Git.

## QA e correções realizadas

- Captions passaram a usar layout flexível; o zoom por palavra só ocorre quando existem timestamps de palavras, evitando colisão visual.
- Animações Three.js dependem apenas do frame e o Chromium usa ANGLE.
- FFprobe confirmou contêiner MP4, H.264, yuv420p, resolução, FPS e duração nos vídeos finais verificados.
- O build FFmpeg do Remotion nesta máquina não contém os filtros `volumedetect` e `blackdetect`. O sistema agora registra a indisponibilidade e mantém análise de silêncio, FFprobe, inspeção por quadros e demais verificações sem fabricar resultados.
- `npm audit` e o validador oficial da estrutura da skill devem permanecer verdes antes de uma release.

## Cobertura não executada

- Blender, faster-whisper e Auto-Editor não estão instalados; seus adaptadores são opcionais e não foram chamados de validados.
- Não havia gravação autorizada de uma pessoa falando para a câmera. Para concluir o Teste C literalmente, forneça uma gravação própria/autorizada e revise os cortes semanticamente.
- Qualidade estética e narrativa continua sendo decisão humana/subjetiva.

## Upgrade 2.1 — narração natural

O baseline antigo foi reprovado: OneCore operava em 1,08×, dois WAVs ultrapassavam cenas de 6 s e eram truncados, e o MP4 continha silêncios artificiais de até 1,7 s entre segmentos. O pipeline 2.1 usa velocidade moderada, WAV PCM mono 48 kHz, `loudnorm`, QA sem filtros opcionais e timeline derivada da duração medida.

Três testes pt-BR foram sintetizados com OneCore, renderizados e comparados: educacional científico, redes sociais e documental. Todos preservaram `playbackRate 1.0`, não apresentaram clipping nem risco de truncamento. Kokoro não foi executado porque o Python local é 3.14 e não há espeak-ng; ElevenLabs não foi executado porque nenhuma chave foi fornecida. A naturalidade deve ser julgada auditivamente pelo usuário nos WAVs e MP4s preservados em `output/narration-tests/`.
