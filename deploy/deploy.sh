#!/usr/bin/env bash
#
# vicinopoli — redeploy after pulling new code on the VPS.
#
# Run on the VPS from /opt/vicinopoli:
#   ./deploy/deploy.sh
#
# Re-pulls source (if you use git on the VPS), rebuilds changed images and
# rolls the stack. Data in the named volumes is preserved.

set -euo pipefail

APP_DIR="/opt/vicinopoli"
cd "${APP_DIR}"

echo "[1/3] Pulling latest source..."
if [ -d .git ]; then
  git pull --ff-only
fi

echo "[2/3] Building images..."
if [ -d .git ]; then
  export VITE_COMMIT_HASH="$(git rev-parse --short HEAD)"
else
  export VITE_COMMIT_HASH="$(cat .commit 2>/dev/null || echo dev)"
fi
docker compose \
  -f deploy/docker-compose.prod.yml \
  --env-file .env \
  build

echo "[3/3] Recreating containers..."
docker compose \
  -f deploy/docker-compose.prod.yml \
  --env-file .env \
  up -d --remove-orphans

echo "Health check:"
curl -fsS "http://localhost/api/health" && echo
docker compose ps
