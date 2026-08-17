# Pages

Short source-of-truth registry of the app's pages. Update this whenever a page
is added, renamed, or removed. Keep it short.

| Page | Responsibility |
|---|---|
| `/` | Redirects to `address` |
| `address` | Ask only "where are you?" -> `feed`; pre-fills the input from the browser location (reverse-geocoded) when no address is set |
| `feed` | Feed + heatmap + `+` button -> `composer`; address bar -> `address`; the `feed-load-more` sentinel triggers endless scroll (IntersectionObserver) |
| `composer` | Compose/publish; message-type chips (`composer-type-*`) show only the selected input — textarea for text, single-line caption (`composer-caption`) for photo/voice; "posting as" link -> `pseudonym` |
| `pseudonym` | Set/clear the pseudonym; on save goes back to the previous page |

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

## Conventions

- Every page is a single route rendered by `App.tsx` via React Router.
- `/` is an alias for `address` (redirect in the router).
- `data-testid` values are short, kebab-case, unique per component, and never
  tied to user-facing copy. UI tests never query by copy.
- `feed` and `composer` redirect to `address` when no address is set.
- The address persists in `localStorage` (`vicinopoli.address`), so `feed` and
  `composer` survive a refresh; clear it via the `address` page.
