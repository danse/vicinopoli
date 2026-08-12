# 0010 — CSS framework

- Status: accepted
- Date: 2026-08-12

## Context

Styling choices are hard to reverse, so we choose early.

## Decision

- **Tailwind CSS** for utility-first styling.
- **shadcn/ui** (Radix primitives) for accessible, copy-paste components.
- This gives design freedom for a map-heavy PWA with a distinctive identity.

## Consequences

- Components are added via the shadcn CLI pattern and customized in-tree.
- Tailwind config is the single theming source.
