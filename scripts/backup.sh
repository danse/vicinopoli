#!/usr/bin/env bash
#
# vicinopoli backups: Postgres dump + MinIO bucket mirror.
#
# Produces backups/<timestamp>/ containing:
#   - postgres.dump  a pg_dump custom-format dump of the app database
#   - media/         a mirror of the object-storage bucket
#
# The backend container mounts ./backups at /backups (docker-compose.yml), so
# both artifacts land on the host under backups/.
#
# Restore the database with:
#   docker compose exec -T db pg_restore -U vicinopoli -d vicinopoli \
#     --clean --if-exists < backups/<timestamp>/postgres.dump
#
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

DB_NAME="${DB_NAME:-vicinopoli}"
DB_USER="${DB_USER:-vicinopoli}"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
HOST_DEST="backups/$STAMP"
CTR_DEST="/backups/$STAMP"

mkdir -p "$HOST_DEST"

echo "==> Postgres dump"
docker compose exec -T db \
  pg_dump --username="$DB_USER" --dbname="$DB_NAME" --format=custom \
  > "$HOST_DEST/postgres.dump"

echo "==> MinIO mirror"
docker compose exec -T backend \
  python -m scripts.backup_minio --destination "$CTR_DEST/media"

echo "==> Backup complete: $HOST_DEST"
ls -lh "$HOST_DEST/postgres.dump"