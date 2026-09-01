# Docker disk usage on the VPS (housekeeping, manual)

## Reading `df -h` without panic

`df` shows one `overlay` line per running container, all with the **same**
numbers:

```
overlay  38G  14G  23G  38%  /var/lib/docker/rootfs/overlayfs/<hash>
overlay  38G  14G  23G  38%  /var/lib/docker/rootfs/overlayfs/<hash>
...
```

These are **not additive**: every container's root filesystem is an overlay
mount on the same backing disk (`/dev/sda1`), and each line reports that
underlying filesystem's total usage. Total used is whatever `/` shows (here
`14G`) — not 14G × N.

## Where the space actually goes

1. **Docker build cache** — every redeploy (`deploy.sh` / `manual.dot`) runs
   `docker compose build`; BuildKit caches every produced layer (the frontend's
   `node:22-alpine` build stage with `npm install` is a classic few-hundred-MB
   cache). This accumulates and is usually the biggest reclaimable chunk.
2. **Old / dangling images** — each rebuilt backend/frontend image leaves the
   previous one behind unless pruned.
3. **Volumes** — `db_data` (Postgres) and `minio_data` (photos/voice uploads,
   grows with usage) live under `/var/lib/docker/volumes/`.
4. The images themselves (postgis ~1GB, backend ~1GB, node build deps, caddy,
   minio, prometheus, grafana).

## Inspect

```bash
docker system df                # images / containers / volumes / build cache, with reclaimable sizes
docker system df -v             # detailed, which images/caches are the big ones
du -sh /var/lib/docker/volumes/*   # volume sizes (db_data, minio_data)
```

## Reclaim (manual; safe for the running stack and named volumes)

```bash
docker builder prune -af        # drop BuildKit cache — usually the biggest win
docker image prune -af          # remove unused/dangling images (keeps running images)
docker system prune -af         # everything above + stopped containers/networks
```

`docker system prune -af` does **not** touch the running stack or the named
volumes (`db_data`, `minio_data`). If the disk approaches full, run this before
the next `docker compose build` — a full disk makes the deploy fail with
"no space left on device".