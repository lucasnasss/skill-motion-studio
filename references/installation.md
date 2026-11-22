# Instalação e compatibilidade

## Pré-requisitos locais

- Node.js 18 ou mais recente e npm 9 ou mais recente.
- Windows x64, macOS 15+ ou Linux glibc 2.35+ com as bibliotecas exigidas pelo Chrome Headless Shell.
- Rede na primeira instalação para `npm ci` e para o navegador controlado pelo Remotion.
- Espaço em disco para dependências, navegador, frames e vídeos.

FFmpeg e FFprobe globais não são obrigatórios. O Remotion 4.0.545 fornece comandos e binários compatíveis usados pelo CLI. Execute `npm run doctor` depois de instalar.

```powershell
cd motion-studio
npm ci
npm run doctor
```

Todos os pacotes Remotion devem permanecer exatamente na mesma versão. Revise licença e breaking changes antes de atualizar o major.

## Instalação no escopo do usuário

Windows, PowerShell:

```powershell
.\scripts\install.ps1 -Scope User -Targets codex,claude,antigravity
```

Linux/macOS:

```bash
./scripts/install.sh --scope user --targets codex,claude,antigravity
```

Os scripts criam junctions ou links simbólicos para esta pasta canônica:

| Cliente | Destino do usuário |
|---|---|
| OpenAI Codex | `~/.agents/skills/motion-studio` |
| Claude Code | `~/.claude/skills/motion-studio` |
| Google Antigravity | `~/.gemini/config/skills/motion-studio` |

O instalador não substitui pastas reais. Para migrar com segurança um link/junction antigo, use `-Update` no PowerShell ou `--update` no shell; a opção troca somente links e recusa diretórios comuns. `-CopyFallback` / `--copy-fallback` cria uma cópia somente quando links não são possíveis e avisa que futuras atualizações podem divergir.

Atualização típica no Codex e Antigravity:

```powershell
.\scripts\install.ps1 -Scope User -Targets codex,antigravity -SkipDependencies -Update
```

## Instalação no projeto

```powershell
.\scripts\install.ps1 -Scope Project -ProjectRoot C:\caminho\do\projeto -Targets codex,claude,antigravity
```

```bash
./scripts/install.sh --scope project --project-root /caminho/do/projeto --targets codex,claude,antigravity
```

Codex e Antigravity compartilham `<projeto>/.agents/skills/motion-studio`; Claude Code usa `<projeto>/.claude/skills/motion-studio`. O link mantém uma única fonte de instruções e runtime.

## Diretórios e superfícies

- Codex local procura skills de projeto em `.agents/skills` e de usuário em `~/.agents/skills`; instalações administrativas também podem existir em `/etc/codex/skills`.
- Claude Code local usa `.claude/skills` ou `~/.claude/skills`.
- Antigravity usa `.agents/skills` no workspace e `~/.gemini/config/skills` globalmente; use `/skills reload` no CLI após adicionar uma skill durante uma sessão.

Skills instaladas localmente não garantem renderização em chats web, Cowork, sessões cloud ou agentes remotos. Esses ambientes podem não montar o filesystem, não preservar binários ou não permitir Chrome/FFmpeg. Neles, mantenha o projeto JSON e renderize numa máquina ou sandbox explicitamente compatível.

## Licença do Remotion

O código desta skill é MIT, mas Remotion tem licença própria e não é software livre OSI. Indivíduos, organizações muito pequenas e alguns usos sem fins lucrativos podem se qualificar para uso gratuito; outros usos exigem licença. Consulte sempre os [preços oficiais](https://www.remotion.dev/docs/license/pricing) e configure `REMOTION_PRIVATE_LICENSE_KEY` quando aplicável. A skill não presume elegibilidade nem compra licença.

