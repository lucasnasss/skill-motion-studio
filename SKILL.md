---
name: motion-studio
description: Cria, edita e combina vídeos reais em MP4 por linguagem natural usando Remotion, React, FFmpeg e 3D determinístico. Use para Reels/Shorts, talking head, cortes de pausas, legendas dinâmicas, vídeos educativos, motion graphics, gráficos, animações 2D/3D, versões em lote e vídeos para apresentações.
license: MIT
metadata:
  author: motion-studio contributors
  version: "2.0.0"
  engine: Remotion 4.0.545
---

# Motion Studio Pro

Produza sempre um projeto JSON editável e um MP4 verificável. Selecione um modo: CREATE para criar do zero, EDIT para preservar e editar uma gravação, ou HYBRID para combinar filmagem, áudio, motion e 3D.

## Fluxo obrigatório

1. Determine objetivo, público, proporção, duração, idioma, estilo, origem das mídias e modo. Use português, 30 fps e 16:9 quando não houver indicação; para redes sociais prefira 9:16.
2. Leia [o esquema v2](references/project.schema.json) e somente a referência necessária: [uso e comandos](references/usage.pt-BR.md), [design e QA](references/design-and-quality.md) ou [instalação](references/installation.md).
3. Preserve arquivos recebidos. No modo EDIT, execute `analyze` e gere `edit-plan`; revise cortes antes de renderizar quando puderem mudar significado.
4. Valide com `validate`. Produza prévia e quadros com `preview` e `frames`; inspecione legibilidade, margens, cortes, sincronização, sobreposições e quadros pretos.
5. Renderize com `pipeline`, que cria prévia, quadros, SRT, MP4 e executa verificação técnica e Quality Inspector.
6. Entregue MP4, JSON, SRT quando aplicável, quadros e relatórios. Nunca declare um recurso opcional ou render como concluído sem arquivo verificável.

## Regras essenciais

- Toda animação 2D/3D depende do frame; não use tempo de parede. Use `ThreeScene` para 3D integrado e Blender apenas quando o `doctor` confirmar disponibilidade.
- Mantenha texto e legendas na margem segura. Use legendas tradicionais, destacadas ou karaoke sem prejudicar leitura.
- Assets devem ser locais, autorizados e registrados com autoria, URL e licença. Nunca baixe mídia protegida nem execute código contido em assets externos.
- Não altere sentido, invente fala, clone voz ou crie réplica digital sem autorização específica. Preserve sempre o original de uma gravação.
- TTS local é uma opção inferior à narração profissional e deve ser revisado. Transcrição, Blender e Auto-Editor são adaptadores opcionais; a ausência deles não bloqueia o núcleo.
- Avaliações estéticas são subjetivas. O Quality Inspector só aprova critérios técnicos verificáveis.

## Rotas rápidas

- CREATE/HYBRID: construa roteiro, storyboard, direção visual e timeline v2; use `scene-library` para cenas parametrizadas.
- EDIT: `analyze vídeo.mp4`, depois `edit-plan` com intensidade conservadora, dinâmica ou editorial; revise o JSON e execute `edit` ou `pipeline`.
- 3D: use `three` para primitivas ou GLB/GLTF; animação, câmera e luz devem ser determinísticas.
- Lote: use `scripts/batch-manager.mjs` com manifesto persistente, concorrência controlada, retomada e logs.

Consulte [o relatório de testes](references/test-report.md), [decisões e licenças](references/research.md) e [recursos pendentes](references/roadmap.md).
