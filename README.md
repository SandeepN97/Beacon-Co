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

Deployed as a Cloudflare Worker with static assets (`beaconco9`), connected to this repo — auto-deploys on every push to `main`. Build command `npm run build`, deploy command `npx wrangler deploy` (Cloudflare's dashboard runs this automatically; `wrangler.jsonc` configures the assets binding and the `/api/contact` route).

### Contact form setup

The contact form posts to `/api/contact`, handled by `src/worker.ts` — it verifies Turnstile, validates fields server-side, and sends the message via Resend. Three values need to be set in the Cloudflare dashboard (Workers & Pages → `beaconco9` → Settings → Variables and Secrets):

| Name | Type | Where to get it |
|---|---|---|
| `PUBLIC_TURNSTILE_SITE_KEY` | Build variable (not secret — this one is public) | Cloudflare dashboard → Turnstile → add a site → copy the Site Key |
| `TURNSTILE_SECRET_KEY` | Secret | Same Turnstile site → copy the Secret Key |
| `RESEND_API_KEY` | Secret | [resend.com](https://resend.com) → sign up → API Keys → create one |

For local testing, copy `.dev.vars.example` to `.dev.vars` (gitignored) and fill in the secret values, then run `npx wrangler dev`.

## The business, in short

A solo-operator agency built around one idea: automate everything except the two moments that need a human — the initial sales call, and approving what an AI drafts before it posts. Target: $299 entry product (Google Business Profile fix), $799 websites, $450/month managed Presence plans, ~93% gross margin once the stack is running.

## Stack

- **Frontend (Phase 1, this repo):** Astro static site → Cloudflare Workers (static assets)
- **Contact form:** Cloudflare Worker route (`src/worker.ts`) + Turnstile + Resend
- **Data:** Supabase (Postgres, Storage, Realtime, RLS)
- **Queue:** pg-boss on Postgres
- **AI:** Claude API, versioned prompt registry, output guards
- **Content:** Satori (static graphics) + JSON2Video (short video) for Phase 1; native Meta/TikTok APIs once platform approvals clear

See `docs/architecture.md` for the full breakdown across all phases.

## Open items

- [ ] Confirm domain availability for the finalized name via a registrar
- [ ] Run a formal USPTO TESS trademark search before committing
- [ ] Full rename pass across all copy once the name is locked
- [x] Wire up the contact form to a real backend (Cloudflare Worker + Turnstile + Resend)
- [x] Set `PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, and `RESEND_API_KEY` in the Cloudflare dashboard — verified end-to-end (real submission → Turnstile pass → email delivered)
- [x] Connect Cloudflare for auto-deploy on push
- [ ] Resend is currently sending from `onboarding@resend.dev` (their shared test address) — verify a custom domain in Resend once one's registered, so it sends from `@beaconandco.com` instead
