# Beacon & Co.

Digital presence services for small businesses within 30 miles of Waynesboro, Virginia — websites, Google Business Profile management, and social content, priced and delivered at a scale most local agencies can't match.

**Status:** naming and brand identity in progress. "Beacon & Co." is the current leading candidate — a working title with no direct trademark or domain collision found in early diligence, but not yet formally cleared through USPTO TESS or confirmed as a purchased domain. The proposal and brand assets below reflect the business plan under its working name; treat the brand name itself as provisional until that's finalized.

## What's in this repo

| File | What it is |
|---|---|
| [`index.html`](./index.html) | The homepage — GitHub Pages serves this automatically at the repo root once Pages is turned on. |
| [`proposal.html`](./proposal.html) | Same content as `index.html`, kept under this name too so any direct links to "the proposal" still resolve. |
| `.nojekyll` | Tells GitHub Pages to skip Jekyll processing — avoids it mangling asset paths. Required for a plain static site like this one. |
| [`brand/beacon-and-co-brand-identity.svg`](./brand/beacon-and-co-brand-identity.svg) | The starter brand guideline sheet — primary lockup, reversed version, icon alone, color palette, and the reasoning behind each choice. |
| [`brand/beacon-logo-showcase.svg`](./brand/beacon-logo-showcase.svg) | The mark shown in real contexts — nav bar, favicon, business card, signage — plus a minimum-size stress test down to 16px. |

## Going live with GitHub Pages

1. Push these files to `main` (or any branch you choose).
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set Source to **Deploy from a branch**, pick `main` and `/ (root)`.
4. Save. The site publishes at `https://sandeepn97.github.io/Beacon-Co/` within a minute or two.


## The business, in short

A solo-operator agency built around one idea: automate everything except the two moments that need a human — the initial sales call, and approving what an AI drafts before it posts. Target: $299 entry product (Google Business Profile fix), $799 websites, $450/month managed Presence plans, ~93% gross margin once the stack is running. The proposal's financial model section is interactive — drag the sliders yourself rather than taking the projections on faith.

## Stack (see proposal.html § "Under the Hood" for the full breakdown)

- **Edge/hosting:** Cloudflare Pages, Turnstile, Pages Functions
- **Data:** Supabase (Postgres, Storage, Realtime, RLS)
- **Queue:** pg-boss on Postgres
- **AI:** Claude API, versioned prompt registry, output guards
- **Content:** Satori (static graphics, $0/client) + JSON2Video (short video, ~$3/client) for Phase 1; native Meta/TikTok APIs once platform approvals clear
- **Site:** Astro on Cloudflare Pages (planned migration from the current single-file build)

## Open items

- [ ] Confirm domain availability for the finalized name via a registrar
- [ ] Run a formal USPTO TESS trademark search before committing
- [ ] Full rename pass across the proposal and site once the name is locked
- [ ] Migrate the marketing site from a single HTML file to Astro components

---
*This proposal was built iteratively with Claude — the interactive financial model, competitor dossiers, and architecture diagrams inside `proposal.html` are all live artifacts, not static screenshots.*
