# 0001 — Name, scope and target market

- Status: accepted
- Date: 2026-08-12

## Context

The product needs a name, a target market, and a localization strategy.

## Decision

- **Name:** `vicinopoli` (from Italian "vicino" = neighbour).
- **Target:** Italy first, with internationalisation (i18n) in place from day
  one.
- **i18n:** Italian (`it`) is the default locale; English (`en`) is maintained
  in parallel. All user-facing strings go through `react-i18next`; no hardcoded
  copy.
- **Domain:** `vicinopoli.it` is the primary candidate; also register `.com`
  and `.app` variants. `.it` requires an EU-based registrant. Do a domain
  availability + trademark check before registering.

## Consequences

- No hardcoded strings in the frontend; every string is a translation key.
- Backend returns locale-independent data; only UI copy is localized.
