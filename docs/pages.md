# Pages

Short source-of-truth registry of the app's pages. Update this whenever a page
is added, renamed, or removed. Keep it short.

| Page | testid anchor | Responsibility |
|---|---|---|
| `/` | - | Redirects to `address` |
| `address` | `address-submit` | Ask only "where are you?" -> `feed` |
| `feed` | `feed-compose` | Feed + heatmap + `+` button -> `composer` |
| `composer` | `composer-*` | Compose/publish; "change" link -> `address` |

## Conventions

- Every page is a single route rendered by `App.tsx` via React Router.
- `/` is an alias for `address` (redirect in the router).
- `data-testid` values are short, kebab-case, unique per component, and never
  tied to user-facing copy.
- `feed` and `composer` redirect to `address` when no address is set.
- The address persists in `localStorage` (`vicinopoli.address`), so `feed` and
  `composer` survive a refresh; clear it via the `address` page.