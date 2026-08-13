#!/usr/bin/env bash
#
# vicinopoli — one-time Hetzner VPS bootstrap.
#
# Run as root (or with sudo) on a fresh Ubuntu 22.04/24.04 Hetzner VPS:
#   wget -qO- https://deb.debian.org/...  (or simply copy & run this file)
#
# Installs: Docker Engine + Compose plugin, sets up the app dir, copies the
# repo, and creates the production .env from the provided template.
#
# Usage:
#   ./setup-vps.sh /path/to/repo .env-file

set -euo pipefail

REPO_DIR="${1:?usage: $0 <path-to-repo> <path-to-env-file>}"
ENV_FILE="${2:?usage: $0 <path-to-repo> <path-to-env-file>}"

APP_DIR="${APP_DIR:-/opt/vicinopoli}"

echo "[1/5] Installing rsync + Docker Engine + Compose plugin..."
apt-get update
apt-get install -y rsync ca-certificates curl gnupg
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin
fi

echo "[2/5] Placing repo at ${APP_DIR}..."
mkdir -p "${APP_DIR}"
# Copy all files (excluding git state, node_modules, venvs, generated output).
rsync -a --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'backend/.venv' \
  --exclude 'frontend/dist' \
  --exclude 'openapi' \
  --exclude 'frontend/src/api/generated' \
  "${REPO_DIR}/" "${APP_DIR}/"

echo "[3/5] Writing production .env..."
install -m 600 "${ENV_FILE}" "${APP_DIR}/.env"

echo "[4/5] Building images and starting the stack..."
cd "${APP_DIR}"
docker compose \
  -f deploy/docker-compose.prod.yml \
  --env-file .env \
  up -d --build

echo "[5/5] Done. Check status:"
docker compose ps

echo
echo "With an sslip.io (or real) hostname in DOMAIN, Caddy provisioned the"
echo "Let's Encrypt certificate automatically. Open https://\${DOMAIN}."
