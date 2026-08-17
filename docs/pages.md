# Pages

Short source-of-truth registry of the app's pages. Update this whenever a page
is added, renamed, or removed. Keep it short.

| Page | Responsibility |
|---|---|
| `/` | Redirects to `address` |
| `address` | Ask only "where are you?" -> `feed`; pre-fills the input from the browser location (reverse-geocoded) when no address is set; a `?address=` query param (from the admin "open the zone" link) **overwrites** the stored address once on mount |
| `feed` | Feed + heatmap + `+` button -> `composer`; address bar -> `address`; the `feed-load-more` sentinel triggers endless scroll (IntersectionObserver) |
| `composer` | Compose/publish; message-type chips (`composer-type-*`) show only the selected input — textarea for text, single-line caption (`composer-caption`) for photo/voice; "posting as" link -> `pseudonym` |
| `pseudonym` | Set/clear the pseudonym; on save goes back to the previous page |
| `admin` (separate Vite entry, `admin.html`) | Internal firehose (ADR 0021): loopback-only (`127.0.0.1:8081`), shared `X-Admin-Token`, lists every post with status/report count/address, "open the zone" link -> public `/address?address=` |

## data-testid anchors

| testid | Page | Purpose |
|---|---|---|
| `address-submit` | `address` | Submit the address |
| `feed-compose` | `feed` | Floating `+` button -> `composer` |
| `feed-change-address` | `feed` | Change-address link -> `address` |
| `feed-post` | `feed` | Each feed post card |
| `feed-load-more` | `feed` | Endless-scroll sentinel (IntersectionObserver) |
| `composer-change-pseudonym` | `composer` | "Posting as" link -> `pseudonym` |
| `composer-*` | `composer` | Composer inputs (message, caption, photo, voice, type chips) |
| `pseudonym-input` | `pseudonym` | Pseudonym text input |
| `pseudonym-submit` | `pseudonym` | Save the pseudonym |
| `admin-token` | `admin` | Admin token password input |
| `admin-login` | `admin` | Sign in with the shared token |
| `admin-error` | `admin` | Token rejected / empty |
| `admin-post` | `admin` | A firehose post card |
| `admin-status` | `admin` | Post status (active/auto_hidden/hidden) |
| `admin-report-count` | `admin` | Report count (bare number) |
| `admin-zone-link` | `admin` | Link to public `/address?address=` |
| `admin-load-more` | `admin` | Endless-scroll sentinel (IntersectionObserver) |

## Conventions

- Every page is a single route rendered by `App.tsx` via React Router.
- `/` is an alias for `address` (redirect in the router).
- `data-testid` values are short, kebab-case, unique per component, and never
  tied to user-facing copy. UI tests never query by copy.
- `feed` and `composer` redirect to `address` when no address is set.
- The address persists in `localStorage` (`vicinopoli.address`), so `feed` and
  `composer` survive a refresh; clear it via the `address` page.
