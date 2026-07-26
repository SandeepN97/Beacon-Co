# Beacon & Co.

Digital presence services for small businesses within 30 miles of Waynesboro, Virginia — websites, Google Business Profile management, and social content, priced and delivered at a scale most local agencies can't match.

**Status:** naming and brand identity in progress. "Beacon & Co." is the current leading candidate — a working title with no direct trademark or domain collision found in early diligence, but not yet formally cleared through USPTO TESS or confirmed as a purchased domain. Treat the brand name itself as provisional until that's finalized.

## What's in this repo

This is an [Astro](https://astro.build) static site — the Phase 1 marketing site, per `docs/architecture.md`.

| Path | What it is |
|---|---|
| `CLAUDE.md` / `AGENTS.md` | Project instructions for AI coding agents (`CLAUDE.md` is a symlink to `AGENTS.md` so both read the same source of truth). |
| `docs/architecture.md` | The full planned system (frontend now, admin dashboard / data layer / job queue / AI layer in later phases) and the design principles behind Phase 1. |
| `docs/brand.md` | Brand tokens — colors, typography, logo usage, voice. |
| `reference/v9-source.html` | The original single-file site this Astro project replaces, kept as a content/behavior reference. |
| `public/brand/*.svg` | Source brand identity and logo-showcase sheets. |
| `src/layouts/BaseLayout.astro` | Page shell — nav, sticky contact pill, footer. |
| `src/components/*.astro` | One component per marketing-site section (Hero, Process, Demo, Services, PricingCards, Honest, ContactForm). |
| `src/styles/global.css` | The shared design-system stylesheet. |

## Development

```sh
npm install
npm run dev      # localhost:4321, hot reload
npm run build    # outputs to dist/ — verify this succeeds before any task is done
npm run preview  # serve the production build locally
```

## Deploying

Target is **Cloudflare Pages** (not yet configured) — connect this repo in the Cloudflare dashboard, build command `npm run build`, output directory `dist`.

## The business, in short

A solo-operator agency built around one idea: automate everything except the two moments that need a human — the initial sales call, and approving what an AI drafts before it posts. Target: $299 entry product (Google Business Profile fix), $799 websites, $450/month managed Presence plans, ~93% gross margin once the stack is running.

## Stack

- **Frontend (Phase 1, this repo):** Astro static site → Cloudflare Pages
- **Edge/hosting (later phases):** Cloudflare Pages Functions, Turnstile
- **Data:** Supabase (Postgres, Storage, Realtime, RLS)
- **Queue:** pg-boss on Postgres
- **AI:** Claude API, versioned prompt registry, output guards
- **Content:** Satori (static graphics) + JSON2Video (short video) for Phase 1; native Meta/TikTok APIs once platform approvals clear

See `docs/architecture.md` for the full breakdown across all phases.

## Open items

- [ ] Confirm domain availability for the finalized name via a registrar
- [ ] Run a formal USPTO TESS trademark search before committing
- [ ] Full rename pass across all copy once the name is locked
- [ ] Wire up the contact form to a real backend (Cloudflare Pages Function + Turnstile) once Phase 2 starts
- [ ] Connect Cloudflare Pages for auto-deploy on push
