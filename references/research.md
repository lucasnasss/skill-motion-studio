# Pesquisa técnica e decisões

Pesquisa realizada em 20 de novembro de 2026. Valores, versões e políticas podem mudar; confirme as fontes antes de atualizar dependências ou recomendar uso comercial.

## Agent Skills e clientes

- A [especificação Agent Skills](https://agentskills.io/specification) define `SKILL.md`, frontmatter obrigatório, `scripts/`, `references/` e `assets`. `name` deve coincidir com a pasta e `description` deve explicar função e acionamento.
- A documentação atual do [Codex](https://learn.chatgpt.com/docs/build-skills) usa `.agents/skills` para projeto e usuário, e distingue skills locais de bundles montados em sandboxes hospedados.
- [Claude Code](https://code.claude.com/docs/en/skills) segue o padrão aberto em `.claude/skills`, com extensões próprias de invocação e contexto. Skills pessoais locais não equivalem automaticamente às superfícies hospedadas.
- O [codelab oficial do Antigravity](https://codelabs.developers.google.com/getting-started-with-antigravity-skills?hl=en) confirma `.agents/skills` no workspace e `~/.gemini/config/skills` globalmente.

Decisão: pasta canônica única e links nos diretórios de cada cliente. `name` e `description` sempre presentes para portabilidade.

## Motor principal

O repositório [remotion-dev/skills](https://github.com/remotion-dev/skills) reúne boas práticas, não um sistema completo de prompt para MP4. Foram reaproveitados os princípios documentados — animação por frame, props em arquivo, quadros representativos e navegador do Remotion — sem copiar textos ou assets. A [documentação de skills do Remotion](https://www.remotion.dev/docs/ai/skills) descreve a instalação upstream.

Remotion 4.0.545 foi fixado com todos os pacotes na mesma versão. A renderização usa H.264/MP4 e os binários FFmpeg/FFprobe fornecidos pelo Remotion. Consulte [requisitos](https://www.remotion.dev/docs), [CLI de render](https://www.remotion.dev/docs/cli/render), [licença e preços](https://www.remotion.dev/docs/license/pricing) e [licença do FFmpeg compilado](https://www.remotion.dev/docs/miscellaneous/ffmpeg-license).

## Motores avaliados

| Motor | Resultado |
|---|---|
| Manim Community | Excelente para matemática e ciência programática; gratuito/MIT. Mantido fora do MVP para evitar segundo runtime, variações entre edições e dependências opcionais de LaTeX. Fontes: [instalação](https://docs.manim.community/en/stable/installation.html) e [saída](https://docs.manim.community/en/stable/tutorials/output_and_config.html). |
| FFmpeg / FFprobe | Obrigatório para codec, pós-processamento futuro e validação. A disponibilidade de codecs depende do build; o CLI registra a versão real. Fontes: [documentação](https://ffmpeg.org/documentation.html), [FFprobe](https://ffmpeg.org/ffprobe.html), [licença](https://ffmpeg.org/legal.html). |
| HTML/Canvas + Playwright | Útil para QA visual ou fallback por sequência de frames, mas gravação de teste não é renderer de produção determinístico. Playwright é Apache-2.0. Fontes: [Playwright](https://playwright.dev/docs/intro), [screenshots](https://playwright.dev/docs/screenshots), [vídeo](https://playwright.dev/docs/videos). |

## Catálogos e serviços

- [Agent Skills Hub](https://github.com/agent-skills-hub/agent-skills-hub) é comunitário. Há divergências de contagem no catálogo e o instalador pode substituir cópias locais; nenhum recurso foi incorporado. Skills comunitárias devem ser auditadas e fixadas por commit.
- “Bugee Apps” não pôde ser confirmado como catálogo técnico de Agent Skills. O recurso encontrável é o aplicativo Bugee iA, voltado a prompts e ferramentas, sem repositório, renderer ou testes verificáveis. Não foi usado.
- [Mage Skills](https://github.com/mage-space/skills) demonstra workflows externos e aprovação de custos, mas requer conta/OAuth, consome créditos e retorna artefatos externos temporários. Foi excluído do MVP; geração por IA exige consentimento, orçamento e revisão de privacidade.

## Limites explícitos da versão 2.0

O núcleo inclui TTS local opcional no Windows e 3D integrado determinístico. Blender, faster-whisper e Auto-Editor permanecem opcionais e não foram instalados no ambiente de aceitação. Música automática, geração de imagem/vídeo por IA, busca autônoma de mídia e interface visual própria não fazem parte do núcleo offline. Essa separação reduz custos, dependências e falhas não determinísticas.

