# Beacon & Co. — Project Instructions

Digital presence agency for small businesses within 30 miles of Waynesboro, VA. Solo-operator business, automated end-to-end except two human touchpoints: the sales call and the content-approval tap.

## Current phase: Phase 1 — Frontend only

We are building **only the marketing site** right now. No backend services, no database, no queue workers yet — those come in later phases and must not be scaffolded speculatively. If a task seems to need backend logic (the contact form, for example), stub it clearly and note the TODO rather than building infrastructure early.

Full system context lives in `docs/architecture.md` — read it before making any structural decision, even in Phase 1, so nothing built now conflicts with what's planned later (naming, env vars, folder conventions).

Brand tokens (colors, fonts, logo usage) live in `docs/brand.md` — read it before writing any component styling.

## Stack for this phase

- **Astro 6**, static output — no SSR adapter needed for a static marketing site
- **Cloudflare Pages** as the eventual deploy target (not configured yet, just keep output Cloudflare-compatible)
- Plain CSS (the existing design already has a clean token system — don't introduce Tailwind or a CSS-in-JS library)
- Vanilla JS scoped per-component via `<script>` tags — no framework runtime (no React, no Vue) for this static site

## Source material

`reference/v9-source.html` is the existing single-file site (~3,350 lines) that this Astro project replaces. It is the source of truth for content and behavior — split it into components, don't rewrite the copy or redesign anything unless asked.

## Non-negotiables

- **No `localStorage`/`sessionStorage`** anywhere — not supported in some deploy targets this project may later use. Keep all state in memory or in Astro's build-time data.
- **No AI-generated stock photos or avatars** in any placeholder content — real local photography only, even as placeholders (use clearly-labeled gray boxes instead of fake AI faces).
- One clear call-to-action per screen — no competing secondary buttons or decorative badges near a CTA (this is a deliberate design rule from user-research, not a style preference — see `docs/architecture.md` § Design Principles).
- Every animation respects `prefers-reduced-motion`.

## Build & verify

```bash
npm run dev      # localhost:4321, hot reload
npm run build     # outputs to dist/ — verify this succeeds before considering any task done
npm run preview   # serve the production build locally
```

After any structural change, run `npm run build` and confirm it completes without errors before reporting the task complete.

## Commit style

Small, single-purpose commits. One component migrated per commit where practical, not one giant "port the whole site" commit.
