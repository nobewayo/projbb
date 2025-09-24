#!/usr/bin/env bash
set -euo pipefail

print_usage() {
  cat <<'USAGE'
Usage: sudo ./scripts/setup-linux.sh [options]

Installs Bitby development dependencies on Debian/Ubuntu desktops and optionally bootstraps the workspace.

Options:
  --skip-docker         Skip Docker Engine + Docker Compose installation.
  --skip-pnpm-install   Do not run "pnpm install" after tooling is ready.
  -h, --help            Show this message and exit.
USAGE
}

if [[ ${1:-} == "-h" || ${1:-} == "--help" ]]; then
  print_usage
  exit 0
fi

INSTALL_DOCKER=1
RUN_PNPM_INSTALL=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-docker)
      INSTALL_DOCKER=0
      shift
      ;;
    --skip-pnpm-install)
      RUN_PNPM_INSTALL=0
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      print_usage >&2
      exit 1
      ;;
  esac
done

if [[ $EUID -ne 0 ]]; then
  echo "This script must be run with sudo or as root." >&2
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This script requires apt-based distributions (Debian/Ubuntu)." >&2
  exit 1
fi

ACTIVE_USER="${SUDO_USER:-$USER}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"

run_as_active_user() {
  if [[ "$ACTIVE_USER" == "root" ]]; then
    "$@"
  else
    sudo -u "$ACTIVE_USER" "$@"
  fi
}

log() {
  echo -e "\n[$(date '+%H:%M:%S')] $*"
}

log "Updating apt package index"
apt-get update -y

log "Installing core build dependencies"
apt-get install -y --no-install-recommends \
  ca-certificates \
  curl \
  git \
  gnupg \
  build-essential \
  pkg-config

ensure_node() {
  if command -v node >/dev/null 2>&1; then
    local version
    version="$(node -v | sed 's/^v//')"
    local major
    major="${version%%.*}"
    if [[ -n "$major" && "$major" -ge 20 ]]; then
      log "Node.js $version already installed"
      return
    fi
    log "Node.js $version is older than 20.x; upgrading"
  else
    log "Node.js not found; installing Node.js 20.x"
  fi

  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
}

ensure_node

if command -v corepack >/dev/null 2>&1; then
  log "Enabling Corepack and activating pnpm"
  corepack enable
  if ! run_as_active_user pnpm --version >/dev/null 2>&1; then
    run_as_active_user corepack prepare pnpm@latest --activate
  fi
else
  log "Corepack unavailable; installing pnpm globally via npm"
  npm install -g pnpm
fi

log "pnpm version: $(run_as_active_user pnpm --version)"

if (( INSTALL_DOCKER )); then
  if command -v docker >/dev/null 2>&1; then
    log "Docker already installed ($(docker --version))"
  else
    log "Setting up Docker Engine repository"
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    . /etc/os-release
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $VERSION_CODENAME stable" \
      > /etc/apt/sources.list.d/docker.list

    log "Installing Docker Engine, CLI, and Compose plugin"
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    if [[ "$ACTIVE_USER" != "root" ]]; then
      log "Adding $ACTIVE_USER to docker group"
      usermod -aG docker "$ACTIVE_USER"
      log "You may need to log out and back in before running docker without sudo."
    fi
  fi
else
  log "Skipping Docker installation (per flag)"
fi

if (( RUN_PNPM_INSTALL )); then
  if [[ -f "$PROJECT_ROOT/pnpm-workspace.yaml" ]]; then
    log "Running pnpm install in $PROJECT_ROOT"
    run_as_active_user bash -lc "cd '$PROJECT_ROOT' && pnpm install"
  else
    log "pnpm-workspace.yaml not found; skipping workspace install"
  fi
else
  log "Skipping pnpm install (per flag)"
fi

log "Setup complete. Open a new terminal session to pick up any new group memberships."
