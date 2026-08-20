# Analytics

How vicinopoli's product analytics work and how to query them.

## What we collect

Consent-gated product analytics (ADR 0014), stored in Postgres in the
`analytics_events` table. Nothing is collected until the device opts in via
the GDPR consent banner; the server drops every event for non-consenting
devices (`POST /api/events` returns `202` with `stored: 0`).

| column | type | notes |
| --- | --- | --- |
| `id` | uuid | event id |
| `device_id` | uuid (fk → `devices.id`) | anonymous device token, never tied to an account |
| `name` | string | event type (below) |
| `geohash` | string | coarse cell only — never a raw address or exact coordinates |
| `post_id` | uuid (nullable) | the post the event refers to, when any |
| `occurred_at` | timestamp (nullable) | client-reported moment of the event |
| `created_at` | timestamp | server receipt time |

Event types (schema `EventName`, `backend/app/schemas/experiments.py`):

| name | sent by | payload |
| --- | --- | --- |
| `post_viewed` | feed (batch, ≤10/page) | `geohash`, `post_id`, `occurred_at` |
| `post_created` | composer on publish | `geohash`, `post_id`, `occurred_at` |
| `onboarding_completed` | consent banner on accept | none |

Privacy: no IP, no raw address, no exact coordinates, no pseudonym. The
Google Ads tag (ADR 0026) is separate — client-side, consent-gated, and lives
in Google's systems, not in this table.

## How to query

### Local dev

The dev stack runs Postgres in Docker (user/password/db `vicinopoli`):

```bash
docker compose exec -T db psql -U vicinopoli -d vicinopoli
```

### Production (VPS)

Postgres is bound inside the Docker network on the VPS and never exposed on
the host or firewall. SSH in and run `psql` inside the container. The compose
file interpolates its variables from `.env`, so pass it explicitly with
`--env-file` (the default project directory is `deploy/`, where compose
looks for a `.env` that isn't there):

```bash
ssh root@<VPS_IP>
cd /opt/vicinopoli
docker compose --env-file .env -f deploy/docker-compose.prod.yml \
  exec -T db psql -U vicinopoli -d vicinopoli
```

One-command alternative with `~/.ssh/config` (`Host vps` → `root@<VPS_IP>`):

```bash
ssh vps 'cd /opt/vicinopoli && docker compose --env-file .env -f deploy/docker-compose.prod.yml exec -T db psql -U vicinopoli -d vicinopoli'
```

## Useful queries

Volume per event type:

```sql
SELECT name, count(*) AS total
FROM analytics_events
GROUP BY name
ORDER BY total DESC;
```

Over time (one row per day per type):

```sql
SELECT name, date_trunc('day', occurred_at) AS day, count(*) AS total
FROM analytics_events
GROUP BY name, day
ORDER BY day;
```

Post views by coarse cell (which neighbourhoods are being read):

```sql
SELECT geohash, count(*) AS views
FROM analytics_events
WHERE name = 'post_viewed'
GROUP BY geohash
ORDER BY views DESC
LIMIT 20;
```

Active (opt-in) devices, total and per event:

```sql
SELECT name, count(DISTINCT device_id) AS devices
FROM analytics_events
GROUP BY name;
```

Publishing activity (since `post_created` was wired):

```sql
SELECT date_trunc('day', occurred_at) AS day, count(*) AS posts
FROM analytics_events
WHERE name = 'post_created'
GROUP BY day
ORDER BY day;
```

Consent uptake (who opted in vs declined vs undecided):

```sql
SELECT analytics_consent, count(*)
FROM devices
GROUP BY analytics_consent;
```

Rough opt-in conversion — devices that both completed onboarding and later
posted:

```sql
SELECT count(DISTINCT e.device_id)
FROM analytics_events e
WHERE e.name = 'post_created'
  AND EXISTS (
    SELECT 1 FROM analytics_events o
    WHERE o.device_id = e.device_id AND o.name = 'onboarding_completed'
  );
```