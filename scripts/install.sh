#!/usr/bin/env bash
set -euo pipefail

scope="user"
targets="codex,claude,antigravity"
project_root=""
copy_fallback="0"
skip_dependencies="0"
update="0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --scope) scope="$2"; shift 2 ;;
    --targets) targets="$2"; shift 2 ;;
    --project-root) project_root="$2"; shift 2 ;;
    --copy-fallback) copy_fallback="1"; shift ;;
    --skip-dependencies) skip_dependencies="1"; shift ;;
    --update) update="1"; shift ;;
    *) echo "Opção desconhecida: $1" >&2; exit 2 ;;
  esac
done

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source_dir="$(cd "$script_dir/.." && pwd)"

if [[ "$skip_dependencies" != "1" ]]; then
  (cd "$source_dir" && npm ci)
fi

if [[ "$scope" == "project" ]]; then
  if [[ -z "$project_root" ]]; then echo "Informe --project-root." >&2; exit 2; fi
  project_root="$(cd "$project_root" && pwd)"
elif [[ "$scope" != "user" ]]; then
  echo "--scope deve ser user ou project." >&2
  exit 2
fi

install_link() {
  local destination="$1"
  if [[ -L "$destination" ]]; then
    local current
    current="$(cd "$(dirname "$destination")" && realpath "$(readlink "$destination")")"
    if [[ "$current" == "$source_dir" ]]; then
      echo "Já instalado: $destination"
      return
    fi
  fi
  if [[ -e "$destination" || -L "$destination" ]]; then
    if [[ "$update" == "1" && -L "$destination" ]]; then
      echo "Atualizando link existente: $destination" >&2
      rm "$destination"
    else
      echo "O destino já existe e não será substituído: $destination. --update troca apenas links simbólicos." >&2
      exit 1
    fi
  fi
  mkdir -p "$(dirname "$destination")"
  if ln -s "$source_dir" "$destination"; then
    echo "Link criado: $destination -> $source_dir"
  elif [[ "$copy_fallback" == "1" ]]; then
    echo "AVISO: criando cópia divergente em $destination" >&2
    cp -R "$source_dir" "$destination"
  else
    echo "Não foi possível criar o link. Use --copy-fallback apenas se aceitar cópias divergentes." >&2
    exit 1
  fi
}

IFS=',' read -r -a requested <<< "$targets"
declare -A seen=()
for target in "${requested[@]}"; do
  if [[ "$scope" == "user" ]]; then
    case "$target" in
      codex) destination="$HOME/.agents/skills/motion-studio" ;;
      claude) destination="$HOME/.claude/skills/motion-studio" ;;
      antigravity) destination="$HOME/.gemini/config/skills/motion-studio" ;;
      *) echo "Target inválido: $target" >&2; exit 2 ;;
    esac
  else
    case "$target" in
      codex|antigravity) destination="$project_root/.agents/skills/motion-studio" ;;
      claude) destination="$project_root/.claude/skills/motion-studio" ;;
      *) echo "Target inválido: $target" >&2; exit 2 ;;
    esac
  fi
  if [[ -z "${seen[$destination]:-}" ]]; then
    seen[$destination]=1
    install_link "$destination"
  fi
done

echo "Instalação concluída. Reinicie o cliente ou recarregue as skills."

