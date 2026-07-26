# System Architecture — Reference

This is the full planned system. **Only the Frontend section is being built right now** — the rest is here so Phase 1 decisions (naming, structure) don't conflict with what comes later.

## Frontend (Phase 1 — build this now)
- **Astro** static site → **Cloudflare Pages** (unlimited bandwidth, free tier)
- **Turnstile** for the contact form (invisible CAPTCHA) — added when the form is wired up, not before
- One Cloudflare Pages Function (`functions/contact.ts`) handles form submission later — do not build this until explicitly asked

## Admin dashboard (Phase 3+ — do not build yet)
- Next.js on Vercel — needs real interactivity (approval queue, live pipeline board) that a static site can't do

## Data layer (Phase 2+ — do not build yet)
- Supabase: Postgres + RLS, Storage, Realtime, scheduled backups with restore drills
- Core tables (for naming consistency only, not to be created now): `leads`, `audits`, `clients`, `subscriptions`, `content_calendar`, `posts`, `metrics`, `events`, `jobs`, `suppression_list`

## Async / job queue (Phase 2+ — do not build yet)
- **pg-boss** on Postgres (validated against Graphile Worker — more stars, more downloads, no Redis dependency)
- Dead-letter queue: 3 failures → park + alert, replayable from dashboard

## Service workers (Phase 3+ — do not build yet)
Six workers, each one job: Lead Engine (Places/Yelp scoring), Outreach (audit PDFs, email sequences), Content (Claude drafts → approval queue → publish), Media Pipeline, Reviews+SEO, Reporting.

## Content generation (Phase 3+ — do not build yet)
- **Pictures:** Satori → SVG → PNG, self-hosted, $0/client
- **Video:** JSON2Video (bundles TTS in one render credit) for Phase 1 of *that* system; Remotion (54k★, Apache-2.0, React-based) is the credible upgrade once volume justifies self-hosting a render worker
- **Social publishing:** Upload-Post (agency-tier, unlimited uploads, official n8n integration) while Meta App Review (4–8wk) and TikTok's Direct Post audit (2–6wk) are pending; swap to native Meta Graph API + TikTok Content Posting API once both clear — $0 in platform fees after that

## AI layer (Phase 3+ — do not build yet)
- Claude API, versioned prompt registry in-repo, per-client brand-voice JSON, structured JSON outputs, output guards with human-review fallback

## Security (Phase 2+ — do not build yet)
- Client OAuth tokens: pgsodium-encrypted at rest, refresh worker, expiry alerts
- Dev/prod fully isolated Supabase projects, no `.env` files committed ever

## Observability (Phase 2+ — do not build yet)
- Sentry (errors), Axiom (structured logs), **Uptime Kuma** self-hosted (85k★ MIT — validated over BetterStack's paid tier; single-location trade-off accepted since Cloudflare's edge serves the actual traffic), cost/quota alarms with hard caps

## Design Principles (applies to Phase 1 now)
Grounded in published eye-tracking research (Nielsen Norman Group), not folklore:
- The F-pattern scanning behavior is a *symptom of poor hierarchy*, not something to design for — break it with short paragraphs, real headers, bolded key phrases
- One CTA per screen, nothing decorative competing with it (see the TechWyse/VWO case study: a non-clickable badge stole attention from the actual button)
- Core promise goes top-left — highest-value real estate on the page
- Real photos of real people, not stock or AI-generated — direct gaze is genuinely attention-grabbing, a stranger's face is not

## Brand
See `docs/brand.md` for tokens. Working name: **Beacon & Co.** (provisional — domain/trademark not yet formally cleared).
