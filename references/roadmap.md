# Estado e recursos pendentes

## Implementado em 2.0

- Projeto v2 versionado com timeline, tracks, clips, mídias verificáveis e compatibilidade com projetos v1.
- CREATE, EDIT e HYBRID; cortes por silêncio, três intensidades, reenquadramento e normalização de áudio.
- Remotion/React, captions tradicionais/destaque/karaoke, SRT e TTS local opcional no Windows.
- Three.js, React Three Fiber e `@remotion/three` com primitivas, GLB/GLTF, materiais, luz, sombra e câmera por frame.
- 12 cenas parametrizadas, quatro estilos iniciais, Quality Inspector e Batch Manager persistente.
- Adaptadores opcionais reais para faster-whisper e Blender, sem bloquear o núcleo quando ausentes.

## Pendências honestas

- Reconhecimento semântico automático de erros/repetições de fala exige transcrição instalada e revisão humana.
- Redução avançada de ruído, seleção automática de B-roll, busca/licenciamento de mídia e provedores TTS externos não estão conectados ao núcleo.
- Blender e faster-whisper não foram validados nesta máquina porque não estão instalados.
- Não há serviço residente: processamento noturno exige Task Scheduler, cron ou outro supervisor configurado pelo usuário.
- Avaliação estética, narrativa e potencial de viralização permanece subjetiva.
- O teste com pessoa falando para a câmera depende de gravação autorizada fornecida pelo usuário; o pipeline técnico é testado com mídia local disponível.

Priorize instalar/testar os adaptadores opcionais e fornecer uma gravação autorizada antes de afirmar cobertura integral de talking head.
