#!/usr/bin/env bash
set -euo pipefail

# LearnSphereEdu setup script
# - Ensures prerequisites (Node.js, npm; optional ffmpeg; Docker if requested)
# - Installs JS dependencies
# - Initializes SQLite DB
# - Resolves port conflicts (kill or auto-switch)
# - Starts the application (dev/prod) or brings up Docker
#
# Usage examples:
#   ./scripts/setup.sh                          # dev mode on port 5000 with ./db.sqlite
#   ./scripts/setup.sh --prod                   # build and start production
#   ./scripts/setup.sh --docker                 # use docker compose up -d
#   ./scripts/setup.sh --port 8080              # custom port
#   ./scripts/setup.sh --db ./data/app.db       # custom db path
#   ./scripts/setup.sh --no-start               # prepare only, do not start
#   ./scripts/setup.sh --yes                    # auto-confirm installs
#   ./scripts/setup.sh --skip-prereqs           # do not attempt to install Node/ffmpeg/Docker
#   ./scripts/setup.sh --force-kill             # auto-kill processes on the chosen port without prompting
#   ./scripts/setup.sh --auto-port              # auto-switch to the next free port if busy
#
# Options:
#   --dev | --prod | --docker   Select run mode (default: --dev)
#   --port <number>             Port to expose (default: 5000)
#   --db <path>                 SQLite database path (default: ./db.sqlite)
#   --no-install                Skip dependency install (npm)
#   --no-start                  Do not start the app (prep only)
#   --yes                       Assume "yes" to all prompts (non-interactive)
#   --skip-prereqs              Skip auto-install of system prerequisites
#   --force-kill                Force-kill any process using the selected port
#   --auto-port                 Automatically switch to next free port if in use
#   -h | --help                 Show help

MODE="dev"
PORT="5000"
DB_PATH="./db.sqlite"
DO_INSTALL=1
DO_START=1
ASSUME_YES=0
SKIP_PREREQS=0
FORCE_KILL=0
AUTO_PORT=0

usage() {
  sed -n '1,160p' "$0" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dev) MODE="dev"; shift ;;
    --prod) MODE="prod"; shift ;;
    --docker) MODE="docker"; shift ;;
    --port) PORT="${2:-}"; shift 2 ;;
    --db) DB_PATH="${2:-}"; shift 2 ;;
    --no-install) DO_INSTALL=0; shift ;;
    --no-start) DO_START=0; shift ;;
    --yes) ASSUME_YES=1; shift ;;
    --skip-prereqs) SKIP_PREREQS=1; shift ;;
    --force-kill) FORCE_KILL=1; shift ;;
    --auto-port) AUTO_PORT=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "[ERROR] Unknown option: $1"; usage; exit 1 ;;
  esac
done

info() { echo "[INFO] $*"; }
warn() { echo "[WARN] $*"; }
err()  { echo "[ERROR] $*" 1>&2; }

confirm() {
  local prompt=${1:-Proceed?}
  if [[ $ASSUME_YES -eq 1 ]]; then return 0; fi
  read -r -p "$prompt [Y/n] " ans || true
  case "${ans:-Y}" in
    Y|y|Yes|yes) return 0 ;;
    *) return 1 ;;
  esac
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then err "Required command not found: $1"; exit 1; fi
}

os_name() { uname -s; }

ensure_dirs() {
  # Ensure uploads subfolders exist (server uses these paths)
  mkdir -p uploads/materials uploads/assignments uploads/thumbnails uploads/notices || true
  # Ensure DB directory exists if DB_PATH is in a subfolder
  DB_DIR="$(dirname "$DB_PATH")"
  mkdir -p "$DB_DIR" || true
}

install_with_brew() {
  local pkg="$1"
  if ! command -v brew >/dev/null 2>&1; then
    warn "Homebrew not found. It is recommended for automatic installs on macOS."
    if confirm "Install Homebrew now?"; then
      /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
      eval "$($(command -v brew) shellenv)"
    else
      err "Homebrew is required to auto-install $pkg. Install it from https://brew.sh and re-run."
      exit 1
    fi
  fi
  info "Installing $pkg via Homebrew"
  brew update || true
  brew install $pkg || true
}

ensure_node() {
  if command -v node >/dev/null 2>&1; then
    local ver major
    ver=$(node -v | sed 's/^v//')
    major=${ver%%.*}
    if [[ "$major" -ge 18 ]]; then return 0; fi
    warn "Node.js $ver detected (<18). Will install a newer version."
  else
    warn "Node.js not found. Will install Node 20."
  fi
  case "$(os_name)" in
    Darwin)
      install_with_brew node@20
      # Prefer linking node@20 if multiple versions exist
      if brew list node@20 >/dev/null 2>&1; then brew link --overwrite --force node@20 || true; fi
      ;;
    Linux)
      if command -v apt-get >/dev/null 2>&1; then
        if confirm "Install Node.js (apt) with sudo?"; then
          sudo apt-get update -y && sudo apt-get install -y nodejs npm
        else
          err "Node.js is required. Install it and re-run."
          exit 1
        fi
      else
        warn "Unsupported Linux package manager for auto-install. Please install Node.js 18+ manually."
      fi
      ;;
    *)
      warn "Automatic Node.js install not supported on $(os_name). Please install Node 18+."
      ;;
  esac
}

ensure_ffmpeg_optional() {
  if command -v ffmpeg >/dev/null 2>&1; then return 0; fi
  case "$(os_name)" in
    Darwin)
      if confirm "ffmpeg not found. Install via Homebrew?"; then
        install_with_brew ffmpeg
      else
        warn "Skipping ffmpeg. Some media features may be limited."
      fi
      ;;
    Linux)
      if command -v apt-get >/dev/null 2>&1; then
        if confirm "ffmpeg not found. Install via apt with sudo?"; then
          sudo apt-get update -y && sudo apt-get install -y ffmpeg
        else
          warn "Skipping ffmpeg. Some media features may be limited."
        fi
      else
        warn "Install ffmpeg manually for full media features."
      fi
      ;;
    *)
      warn "Install ffmpeg manually for full media features."
      ;;
  esac
}

ensure_docker_if_requested() {
  if [[ "$MODE" != "docker" ]]; then return 0; fi
  if command -v docker >/dev/null 2>&1; then return 0; fi
  case "$(os_name)" in
    Darwin)
      warn "Docker not found. Docker Desktop is required for --docker mode."
      if confirm "Install Docker Desktop via Homebrew Cask?"; then
        install_with_brew --cask docker || true
        # Try to launch Docker Desktop (user may need to grant permissions)
        if [[ -d "/Applications/Docker.app" ]]; then
          open -a "/Applications/Docker.app" || true
          info "Docker Desktop launched. Wait until it finishes starting before continuing."
        fi
      else
        err "Docker is required for --docker mode. Install Docker Desktop and re-run."
        exit 1
      fi
      ;;
    Linux)
      warn "Docker not found. Please install Docker Engine for your distro and re-run."
      exit 1
      ;;
    *)
      warn "Please install Docker for your OS and re-run with --docker."
      exit 1
      ;;
  esac
}

# ---------- Port conflict helpers ----------
port_open() {
  local p="$1"
  nc -z 127.0.0.1 "$p" >/dev/null 2>&1 || nc -z localhost "$p" >/dev/null 2>&1
}

get_pids_on_port() {
  local p="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -ti :"$p" || true
  else
    echo "" # lsof not available
  fi
}

kill_pids() {
  local pids="$*"
  if [[ -z "$pids" ]]; then return 0; fi
  info "Killing processes: $pids"
  kill -9 $pids || true
}

find_free_port() {
  local start=${1:-5000}
  local end=$((start+100))
  local p
  for ((p=start; p<=end; p++)); do
    if ! port_open "$p"; then
      echo "$p"
      return 0
    fi
  done
  echo "" # none found
}

resolve_port_conflict() {
  # Loop until selected PORT is free or conflict is resolved
  while port_open "$PORT"; do
    local pids
    pids=$(get_pids_on_port "$PORT")
    if [[ -n "$pids" ]]; then
      warn "Port $PORT is in use by PID(s): $pids"
      if [[ $FORCE_KILL -eq 1 ]]; then
        kill_pids $pids
        sleep 1
        continue
      fi
      if confirm "Kill these processes now?"; then
        kill_pids $pids
        sleep 1
        continue
      fi
    else
      warn "Port $PORT is in use (no PID info available)."
    fi

    if [[ $AUTO_PORT -eq 1 ]]; then
      local newp
      newp=$(find_free_port "$PORT")
      if [[ -n "$newp" ]]; then
        info "Switching to free port $newp"
        PORT="$newp"
        break
      else
        err "Could not find a free port near $PORT."
        exit 1
      fi
    fi

    # Ask user to choose action
    echo "Port $PORT is busy. Choose an option:"
    echo "  1) Kill process(es) using $PORT"
    echo "  2) Switch to next free port"
    echo "  3) Abort"
    read -r -p "Select [1/2/3]: " choice || true
    case "${choice:-1}" in
      1)
        [[ -n "$pids" ]] && kill_pids $pids || warn "No PID info to kill. Try option 2."
        sleep 1
        ;;
      2)
        local newp
        newp=$(find_free_port "$PORT")
        if [[ -n "$newp" ]]; then
          info "Switching to free port $newp"
          PORT="$newp"
          break
        else
          err "Could not find a free port near $PORT."
          exit 1
        fi
        ;;
      *)
        err "Aborted due to port conflict."
        exit 1
        ;;
    esac
  done
}

install_deps() {
  if [[ $DO_INSTALL -eq 0 ]]; then return; fi
  require_cmd npm
  if [[ -f package-lock.json ]]; then
    info "Installing dependencies (npm ci)"
    npm ci
  else
    info "Installing dependencies (npm install)"
    npm install
  fi
}

init_db() {
  info "Initializing SQLite schema at $DB_PATH"
  DATABASE_URL="$DB_PATH" node ./scripts/init-db.js
}

start_dev() {
  info "Starting in development mode on port $PORT"
  export NODE_ENV=development
  export PORT="$PORT"
  export DATABASE_URL="$DB_PATH"
  npm run dev
}

start_prod() {
  info "Building client and server"
  npm run build
  info "Starting in production mode on port $PORT"
  export NODE_ENV=production
  export PORT="$PORT"
  export DATABASE_URL="$DB_PATH"
  npm start
}

bring_up_docker() {
  # Prefer docker compose v2 but support docker-compose
  if command -v docker compose >/dev/null 2>&1; then
    info "Bringing up Docker stack (docker compose up -d)"
    docker compose -f docker-compose.yml up -d
  else
    info "Bringing up Docker stack (docker-compose up -d)"
    docker-compose -f docker-compose.yml up -d
  fi
  info "Docker service should be reachable on http://localhost:$PORT (default 5000)"
}

check_node_version() {
  if ! command -v node >/dev/null 2>&1; then
    warn "Node.js not found."
    return
  fi
  VER=$(node -v | sed 's/v//')
  MAJOR=${VER%%.*}
  if [[ "$MAJOR" -lt 18 ]]; then
    warn "Detected Node $VER. Please use Node 18+ for best compatibility."
  fi
}

post_checks() {
  # Optional: warn if ffmpeg is missing (used for media processing)
  if ! command -v ffmpeg >/dev/null 2>&1; then
    warn "ffmpeg not found. Some media features may be limited."
  fi
}

ensure_prereqs() {
  if [[ $SKIP_PREREQS -eq 1 ]]; then return; fi
  # Auto-confirm if --yes
  if [[ $ASSUME_YES -eq 1 ]]; then :; fi
  if [[ "$MODE" == "docker" ]]; then
    ensure_docker_if_requested
  fi
  ensure_node
  ensure_ffmpeg_optional
}

main() {
  # Pre-flight
  ensure_prereqs
  check_node_version

  if [[ "$MODE" == "docker" ]]; then
    bring_up_docker
    exit 0
  fi

  ensure_dirs
  install_deps
  init_db
  resolve_port_conflict
  post_checks

  if [[ $DO_START -eq 0 ]]; then
    info "Setup complete. Skipping start due to --no-start flag."
    echo "Next: run one of these commands:"
    echo "  Dev:  PORT=$PORT DATABASE_URL=$DB_PATH npm run dev"
    echo "  Prod: PORT=$PORT DATABASE_URL=$DB_PATH npm run build && npm start"
    return
  fi

  case "$MODE" in
    dev)  start_dev ;;
    prod) start_prod ;;
    *) err "Invalid mode: $MODE"; exit 1 ;;
  esac
}

main "$@"