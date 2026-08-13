# Deployment (Hetzner VPS)

Deploy vicinopoli to a single Hetzner VPS running the whole stack in Docker.

This repo works in two modes:

- **Dev** — `docker-compose.yml` + `Caddyfile` (port 8080/8443, no TLS). For local work.
- **Prod** — `deploy/docker-compose.prod.yml` + `deploy/Caddyfile.prod` (ports 80/443,
  Let's Encrypt TLS). Self-contained (does not merge the dev file) to avoid
  docker-compose port-resolution footguns. Built and run **on the server**.

## Prerequisites

- A Hetzner VPS (Ubuntu 22.04/24.04, ~2 GB RAM is enough for now), with a public
  IPv4.
- Optional: a domain whose `A` record points at the VPS IP. **No domain is
  required to deploy** — see "Without a domain" below.
- `rsync` on your local machine.

## One-time server setup

1. Create the app's `.env` locally from the template (never commit real secrets):

   ```bash
   cp deploy/.env.prod.example .env.prod
   $EDITOR .env.prod     # set DOMAIN and strong DB/MinIO passwords
   ```

   A ready-made one already exists at `deploy/.env.prod` (gitignored) when
   prepped by an agent — check it before using.

2. Copy this repo to the server and run the bootstrap (as root / sudo):

   ```bash
   # from a local machine with access to the project dir
   rsync -a --exclude '.git' --exclude 'node_modules' \
       --exclude 'backend/.venv' --exclude 'frontend/dist' \
       --exclude 'frontend/src/api/generated' \
       ./ root@<VPS_IP>:/tmp/vicinopoli/

   ssh root@<VPS_IP> 'bash /tmp/vicinopoli/deploy/setup-vps.sh /tmp/vicinopoli /tmp/vicinopoli/deploy/.env.prod'
   ```

   `setup-vps.sh` installs Docker Engine + Compose, copies the repo to
   `/opt/vicinopoli`, writes `.env`, builds images and starts the stack.

3. If you used a hostname, wait for DNS to propagate, then open `https://<host>`;
   Caddy fetches a Let's Encrypt cert automatically on first request. With a bare
   IP, open `http://<ip>` (plain HTTP).

## Domain

`DOMAIN` in `.env` drives the behaviour:

| `DOMAIN` value                  | Result                                         |
|---------------------------------|------------------------------------------------|
| `vicinopoli.it` (registered)    | Let's Encrypt HTTPS cert for the real domain.  |
| `203.0.113.7.sslip.io` (free)   | Real Let's Encrypt HTTPS cert, PWA-installable.|
| `203.0.113.7` (bare IP)         | Caddy serves plain HTTP on `:80`, no cert.     |

The registered domain is `vicinopoli.it`; `.env.prod.example` ships with
`DOMAIN=vicinopoli.it` and `MEDIA_PUBLIC_BASE_URL=https://vicinopoli.it/media`.
Point a DNS A/AAAA record at the VPS public IP. `sslip.io` resolves any
`<ip>.sslip.io` to that IP, so no DNS setup is needed for the fallback. HTTPS is
required for PWA/service-worker install and for the browser's geolocation API
used in later milestones.

## Redeploy after a change

```bash
. deploy/manual.dot
```

Data lives in the named volumes (`db_data`, `minio_data`) and survives redeploys.

## What is NOT set up yet

- **Backups** — automatic Postgres dumps + MinIO mirroring (planned in milestone 6).
- **Sentry** — set `SENTRY_DSN` in `.env` and pass `VITE_SENTRY_DSN` at frontend
  build to enable.
- **Domain email / SPF** — only relevant once you send mail.
- **Production hardening** — the DB is not exposed publicly (correct), but there
  is no firewall automation on the VPS yet; at minimum allow only 22/80/443 on
  the Hetzner firewall and set `POSTGRES_PASSWORD`/`MINIO_ROOT_PASSWORD` to long
  random values.

## Ports / security

- Caddy: `80`→HTTPS redirect, `443`→TLS. Do **not** expose `9001` (MinIO console)
  or `5432` (Postgres) publicly — the prod compose keeps them internal.
- MinIO console is intentionally not published on the host in prod.
