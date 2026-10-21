#!/usr/bin/env bash
# Simula o passo de CI do TechDocs: clona o repo, gera o site com techdocs-cli
# e publica no storage local lido pelo Backstage (techdocs.publisher.type: local).
#
# Uso:
#   scripts/techdocs-publish.sh [--target local|azurite] <repo-git-url> [ref]
#   scripts/techdocs-publish.sh [--target local|azurite] --all   # repos de scripts/repos.txt
#
# --target local    (padrão) copia para techdocs-storage/ (publisher.type: local)
# --target azurite  envia ao Azure Blob emulado (publisher.type: azureBlobStorage); ver specs/04
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STORAGE="${TECHDOCS_STORAGE:-$ROOT/techdocs-storage}"
VENV="$ROOT/.venv"
TECHDOCS_CLI="@techdocs/cli@1.13.0"
TARGET=local

usage() {
  echo "uso: $0 [--target local|azurite] <repo-git-url> [ref] | --all" >&2
  exit 2
}

setup_env() {
  [[ -x "$VENV/bin/mkdocs" ]] || {
    echo "erro: $VENV sem mkdocs; rode: python3 -m venv .venv && .venv/bin/pip install -r requirements.txt" >&2
    exit 1
  }
  # shellcheck disable=SC1091
  source "$VENV/bin/activate"
  if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
    # shellcheck disable=SC1091
    source "$HOME/.nvm/nvm.sh" && nvm use 24 >/dev/null
  fi
}

# Para cada entidade com techdocs-ref, imprime "<namespace>/<kind>/<name>\t<dir>"
# (triplet em minúsculas; dir relativo à raiz do repo). Um repo pode ter várias docs.
doc_entities() {
  python - "$1" <<'EOF'
import sys, yaml
found = False
with open(sys.argv[1]) as f:
    for doc in yaml.safe_load_all(f):
        meta = (doc or {}).get("metadata", {})
        ref = meta.get("annotations", {}).get("backstage.io/techdocs-ref")
        if not ref:
            continue
        if not ref.startswith("dir:"):
            sys.exit(f"{meta['name']}: só techdocs-ref 'dir:' é suportado (recebido {ref!r})")
        ns = meta.get("namespace", "default")
        print(f"{ns}/{doc['kind']}/{meta['name']}".lower() + "\t" + ref[len("dir:"):])
        found = True
if not found:
    sys.exit("nenhuma entidade com backstage.io/techdocs-ref")
EOF
}

publish() {
  local url="$1" ref="${2:-main}" tmp entity dir dest entities
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' RETURN

  echo "==> $url ($ref)"
  git clone -q --depth 1 --branch "$ref" "$url" "$tmp/src"
  entities="$(doc_entities "$tmp/src/catalog-info.yaml")"

  while IFS=$'\t' read -r entity dir; do
    rm -rf "$tmp/site"
    npx -y "$TECHDOCS_CLI" generate --no-docker \
      --source-dir "$tmp/src/$dir" --output-dir "$tmp/site" >/dev/null </dev/null

    if [[ "$TARGET" == "azurite" ]]; then
      node "$ROOT/scripts/techdocs-azure-publish.cjs" "$tmp/site" "$entity" </dev/null
      echo "    publicado em azurite: techdocs/$entity"
      continue
    fi

    dest="$STORAGE/$entity"
    rm -rf "$dest"
    mkdir -p "$(dirname "$dest")"
    mv "$tmp/site" "$dest"
    echo "    publicado em $dest"
  done <<<"$entities"
}

if [[ "${1:-}" == "--target" ]]; then
  TARGET="${2:-}"
  shift 2 || usage
fi
[[ "$TARGET" == "local" || "$TARGET" == "azurite" ]] || usage
[[ $# -ge 1 ]] || usage
setup_env

if [[ "$TARGET" == "azurite" ]]; then
  "$ROOT/scripts/azurite.sh" status >/dev/null || {
    echo "erro: azurite parado; rode scripts/azurite.sh up" >&2
    exit 1
  }
  [[ -n "${AZURE_STORAGE_CONNECTION_STRING:-}" ]] || eval "$("$ROOT/scripts/azurite.sh" env)"
fi

if [[ "$1" == "--all" ]]; then
  grep -vE '^\s*(#|$)' "$ROOT/scripts/repos.txt" | while read -r url ref; do
    publish "$url" "${ref:-main}"
  done
else
  publish "$@"
fi
