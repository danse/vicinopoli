# 0026 — Google Ads (AW-) tag, consent-gated

- Status: accepted
- Date: 2026-08-19

## Context

We want to track visitors coming from Google campaigns. A Google Ads
conversion tag (`AW-…`) was chosen over GA4: the owner runs Google Ads and
wants conversion/audience data, not full acquisition reporting. The app is a
privacy-first PWA with no accounts; existing analytics (ADR 0014) are
self-hosted, privacy-safe and gated behind an explicit GDPR consent banner.

## Decision

- Load the **gtag.js** Google Ads tag on the **public app only** (never on the
  internal admin tool) with a single build-time id, `VITE_GTAG_ID`.
- The id is empty in dev/test/e2e builds, so no tag is ever loaded there.
- The tag is gated by the **existing GDPR consent banner** using **Consent
  Mode v2**: `ad_storage`, `ad_user_data`, `ad_personalization` default to
  `denied` at load; accepting the banner updates them to `granted`, declining
  keeps them `denied`. The server-side consent gate (ADR 0014) is untouched —
  Google consent is enforced purely client-side, before any data is sent.
- SPA route changes push `page_view` config calls so Ads attribution sees real
  paths.
- Loading the feed fires the "Page view" conversion event
  (`AW-18396502888/fiC1CP7z0eMcEOi2kcRE`, `value: 1.0`, `currency: views`)
  — only for users who consented to the tag.
- The module (`frontend/src/lib/analytics.ts`) no-ops when the id is unset,
  so the whole feature is inert unless a tag id is supplied at build time.

## Consequences

- Opt-in means: a visitor who declines never loads the Google script.
- The consent banner copy now discloses that data is shared with Google on
  opt-in.
- No backend/API changes; no CSP changes (the site sets no CSP header).
- Data leaves the app to Google only for consenting devices — a deliberate
  trade-off vs the fully self-hosted ADR 0014 analytics.
