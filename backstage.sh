#!/usr/bin/env bash
# Backstage + TechDocs (PoC) com um comando.
#
#   ./backstage.sh start    prepara tudo, clona os repos de docs, sobe o Azurite,
#                           publica as docs e sobe o Backstage em http://localhost:3000
#   ./backstage.sh stop     para o Backstage e o Azurite
#   ./backstage.sh delete   remove tudo que o start criou (pede confirmação; -y para não pedir)
#
#   ./backstage.sh status   mostra o que está rodando
#   ./backstage.sh logs     acompanha o log do Backstage
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP="$ROOT/app"
REPOS="$ROOT/repos"
TOOLS="$ROOT/.tools"
RUN="$ROOT/.run"
PID_FILE="$RUN/backstage.pid"
LOG="$RUN/backstage.log"
FRONTEND=http://localhost:3000
BACKEND=http://localhost:7007
NODE_VERSION=24
PLANTUML_VERSION=1.2026.8

info() { printf '\033[1;34m▸\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m✔\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m✘\033[0m %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------- pré-requisitos

check_prereqs() {
  local missing=()
  for cmd in git gh curl python3 podman ss; do
    command -v "$cmd" >/dev/null || missing+=("$cmd")
  done
  [[ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]] || missing+=("nvm")
  [[ ${#missing[@]} -eq 0 ]] || die "Pré-requisitos ausentes: ${missing[*]} (veja o README)"

  python3 -c 'import sys, venv; sys.exit(sys.version_info < (3, 10))' 2>/dev/null ||
    die "Python 3.10+ com o módulo venv é necessário"
  gh auth status >/dev/null 2>&1 || die "GitHub CLI sem login: rode 'gh auth login'"
  podman info >/dev/null 2>&1 || die "Podman não responde: verifique 'podman info'"
  command -v java >/dev/null || warn "Java não encontrado: diagramas PlantUML não serão gerados"
}

# ---------------------------------------------------------------- preparação

setup_node() {
  # shellcheck disable=SC1091
  source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  nvm use "$NODE_VERSION" >/dev/null 2>&1 || {
    info "Instalando Node $NODE_VERSION (nvm)"
    nvm install "$NODE_VERSION" >/dev/null
    nvm use "$NODE_VERSION" >/dev/null
  }
  corepack enable >/dev/null 2>&1 || true
  if [[ ! -d "$APP/node_modules" ]]; then
    info "Instalando dependências do Backstage (primeira vez: alguns minutos)"
    (cd "$APP" && yarn install >"$RUN/yarn-install.log" 2>&1) || die "yarn install falhou: $RUN/yarn-install.log"
  fi
}

setup_python() {
  if [[ ! -x "$ROOT/.venv/bin/mkdocs" ]]; then
    info "Criando ambiente Python (mkdocs-techdocs-core)"
    python3 -m venv "$ROOT/.venv"
    "$ROOT/.venv/bin/pip" install -q --disable-pip-version-check -r "$ROOT/requirements.txt"
  fi
}

# PlantUML local ao projeto (.tools/), usado pelo techdocs-core ao gerar as docs
setup_plantuml() {
  command -v java >/dev/null || return 0
  if [[ ! -x "$TOOLS/bin/plantuml" ]]; then
    info "Baixando PlantUML $PLANTUML_VERSION"
    mkdir -p "$TOOLS/bin"
    curl -fsSL -o "$TOOLS/plantuml.jar" \
      "https://github.com/plantuml/plantuml/releases/download/v$PLANTUML_VERSION/plantuml-$PLANTUML_VERSION.jar"
    printf '#!/usr/bin/env bash\nexec java -Djava.awt.headless=true -jar "%s" "$@"\n' "$TOOLS/plantuml.jar" >"$TOOLS/bin/plantuml"
    chmod +x "$TOOLS/bin/plantuml"
  fi
  export PATH="$TOOLS/bin:$PATH"
}

# Clona (ou atualiza) os repositórios com docs listados em scripts/repos.txt
sync_repos() {
  mkdir -p "$REPOS"
  info "Sincronizando repositórios de docs em repos/"
  grep -vE '^\s*(#|$)' "$ROOT/scripts/repos.txt" | while read -r url _; do
    local dir="$REPOS/$(basename "$url" .git)"
    if [[ -d "$dir/.git" ]]; then
      git -C "$dir" pull -q --ff-only || warn "Não foi possível atualizar $(basename "$dir")"
    else
      git clone -q "$url" "$dir"
    fi
  done
}

# Publica no Azurite só os repos que mudaram desde a última publicação
publish_docs() {
  local count=0
  # Os marcadores valem para um volume específico do Azurite: se o volume foi recriado
  # (ex.: delete de outro clone), as docs sumiram e tudo é publicado de novo
  local volume_id
  volume_id="$(podman volume inspect -f '{{.CreatedAt}}' techdocs-azurite 2>/dev/null || true)"
  if [[ "$(cat "$RUN/azurite-volume" 2>/dev/null)" != "$volume_id" ]]; then
    rm -f "$RUN"/published-*
    echo "$volume_id" >"$RUN/azurite-volume"
  fi
  for dir in "$REPOS"/*/; do
    dir="${dir%/}"
    [[ -f "$dir/catalog-info.yaml" ]] && grep -q 'backstage.io/techdocs-ref' "$dir/catalog-info.yaml" || continue
    local name head marker
    name="$(basename "$dir")"
    head="$(git -C "$dir" rev-parse HEAD)"
    marker="$RUN/published-$name"
    [[ "$(cat "$marker" 2>/dev/null)" == "$head" ]] && continue
    # file://: clone local raso a partir de repos/; os logs detalhados ficam em .run/publish.log
    "$ROOT/scripts/techdocs-publish.sh" --target azurite "file://$dir" </dev/null 2>>"$RUN/publish.log" |
      sed -n 's#.*publicado em azurite: techdocs/#  ✔ #p'
    echo "$head" >"$marker"
    count=$((count + 1))
  done
  if [[ $count -eq 0 ]]; then ok "Docs já publicadas e atualizadas"; else ok "$count repositório(s) publicado(s)"; fi
}

# ---------------------------------------------------------------- processo

running() { [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; }
healthy() {
  curl -sf -m 5 -o /dev/null "$BACKEND/.backstage/health/v1/readiness" &&
    curl -sf -m 5 -o /dev/null "$FRONTEND"
}

# Processos deste app escutando nas portas 3000/7007 (ex.: restos de uma execução anterior)
port_pids() {
  { ss -ltnp 2>/dev/null | grep -E ':(3000|7007) ' | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u || true; } |
    while read -r pid; do
      if [[ "$(readlink -f "/proc/$pid/cwd" 2>/dev/null)" == "$APP"* ]]; then echo "$pid"; fi
    done
}

kill_backstage() {
  if running; then
    # setsid no start: o PID salvo lidera o grupo (yarn, frontend e backend)
    kill -TERM -- "-$(cat "$PID_FILE")" 2>/dev/null || true
    for _ in $(seq 1 15); do running || break; sleep 1; done
    running && kill -KILL -- "-$(cat "$PID_FILE")" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
  local leftovers
  leftovers="$(port_pids)"
  if [[ -n "$leftovers" ]]; then
    # shellcheck disable=SC2086
    kill $leftovers 2>/dev/null || true
    sleep 2
  fi
}

# ---------------------------------------------------------------- comandos

cmd_start() {
  mkdir -p "$RUN"
  if running && healthy; then
    ok "Backstage já está rodando: $FRONTEND"
    return
  fi
  kill_backstage

  check_prereqs
  setup_node
  setup_python
  setup_plantuml
  sync_repos

  info "Subindo o Azurite (Azure Blob Storage emulado)"
  "$ROOT/scripts/azurite.sh" up
  eval "$("$ROOT/scripts/azurite.sh" env)"
  publish_docs

  info "Subindo o Backstage"
  GITHUB_TOKEN="${GITHUB_TOKEN:-$(gh auth token)}"
  export GITHUB_TOKEN
  (
    cd "$APP"
    setsid yarn start --config ../../app-config.yaml --config ../../app-config.azurite.yaml \
      </dev/null >"$LOG" 2>&1 &
    echo $! >"$PID_FILE"
  )

  for _ in $(seq 1 150); do
    if healthy; then
      ok "Pronto: $FRONTEND  (entre como guest)"
      return
    fi
    running || die "O Backstage parou ao iniciar. Veja: $LOG"
    sleep 2
  done
  die "Tempo esgotado esperando o Backstage. Veja: $LOG"
}

cmd_stop() {
  info "Parando o Backstage"
  kill_backstage
  if command -v podman >/dev/null && podman container exists azurite 2>/dev/null; then
    "$ROOT/scripts/azurite.sh" down
  fi
  ok "Tudo parado"
}

cmd_delete() {
  if [[ "${1:-}" != "-y" ]]; then
    echo "Isto remove tudo que o start criou:"
    echo "  - repos/ (clones dos repositórios de docs; o conteúdo continua no GitHub)"
    echo "  - container e volume do Azurite (docs publicadas)"
    echo "  - .venv/, .tools/, .run/, techdocs-storage/"
    echo "  - app/node_modules e o banco local (app/packages/backend/sqlite-data: avaliações e catálogo)"
    echo "O código, as specs e os scripts NÃO são removidos."
    read -r -p "Continuar? [s/N] " answer
    [[ "$answer" =~ ^[sSyY]$ ]] || { warn "Cancelado"; return; }
  fi
  cmd_stop
  if command -v podman >/dev/null; then
    podman rm -f azurite >/dev/null 2>&1 || true
    podman volume rm -f techdocs-azurite >/dev/null 2>&1 || true
  fi
  rm -rf "$REPOS" "$ROOT/.venv" "$TOOLS" "$RUN" "$ROOT/techdocs-storage" \
    "$APP/node_modules" "$APP/packages/backend/sqlite-data" "$APP/.yarn/install-state.gz"
  ok "Ambiente removido. Para recriar: ./backstage.sh start"
}

cmd_status() {
  if running && healthy; then
    ok "Backstage rodando: $FRONTEND (PID $(cat "$PID_FILE"))"
  elif running; then
    warn "Backstage iniciando ou com erro (./backstage.sh logs)"
  else
    warn "Backstage parado"
  fi
  if command -v podman >/dev/null && podman container exists azurite 2>/dev/null; then
    info "Azurite: $("$ROOT/scripts/azurite.sh" status || true)"
  else
    info "Azurite: não criado"
  fi
}

case "${1:-}" in
  start)  cmd_start ;;
  stop)   cmd_stop ;;
  delete) cmd_delete "${2:-}" ;;
  status) cmd_status ;;
  logs)   tail -n 50 -f "$LOG" ;;
  *)
    sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'
    exit 2
    ;;
esac
