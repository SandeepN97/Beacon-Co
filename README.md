# Beacon & Co. — Governed AI-Assisted Operations for Local Service Businesses

> **A real marketing and lead-capture surface paired with an architecture-first, provider-neutral orchestration and decision-system project.** Beacon explores how AI-assisted business operations can be made explicit, auditable, approval-aware, and maintainable rather than hidden behind one giant prompt.

Beacon & Co. is a small-business digital-presence project built with **Astro, TypeScript, Markdoc, Cloudflare Workers, architecture decision records, security policy as code, and a typed AI-orchestration simulation**. The project combines a working customer-facing site with a deeply documented engineering system for approvals, provider adapters, audit, decision records, provenance, and controlled delivery.

**Useful for engineers exploring:** AI orchestration, agent governance, human-in-the-loop approvals, provider-neutral adapters, architecture-as-documentation, ADRs, secure CI/CD, and machine-readable engineering context.

### What is implemented vs. planned

| Area | Current state |
| --- | --- |
| **Marketing site** | Implemented in Astro and deployed through the controlled Cloudflare path |
| **Contact flow** | Implemented with Cloudflare Worker, Turnstile, validation, and Resend |
| **Engineering handbook** | Implemented in Astro + Markdoc with search, ADRs, provenance, diagrams, roadmap, and operations docs |
| **Orchestration layer** | Implemented as a typed simulation with retrieval, broker/router, provider adapters, approvals, audit, continuation, and workflow gates |
| **Decision OS / Phase 1.6** | In progress; typed schemas/events/IDs have started, authority invariants are not yet complete |
| **Operational data / queue / native AI APIs** | Planned; not represented as production-complete |

> **Truthful boundary:** this repository deliberately distinguishes implemented production-facing pieces, implemented simulations, and planned integrations. The orchestration architecture is substantial, but it should not be read as a claim that every future provider/data/queue integration is already live.

---

## Why this project exists

Most AI-enabled application demos optimize for the shortest path from prompt to output. Beacon is exploring the harder questions that appear when software must remain understandable over time:

- Which decisions should an AI provider be allowed to make?
- Where must a human approve consequential actions?
- How do Claude, Codex, or future providers remain replaceable adapters rather than architectural dependencies?
- How are important decisions, evidence, provenance, and release state recorded?
- How do documentation and architecture evolve with the code instead of becoming stale diagrams?
- How can CI/CD enforce security and release policy rather than merely run a build?

That makes Beacon both a business project and an evolving **AI systems / software architecture laboratory**.

---

## Business scope

Digital presence services for small businesses within 30 miles of Waynesboro, Virginia — websites, Google Business Profile management, and social content, priced and delivered at a scale most local agencies can't match.

**Status:** naming and brand identity in progress. "Beacon & Co." is the current leading candidate — a working title with no direct trademark or domain collision found in early diligence, but not yet formally cleared through USPTO TESS or confirmed as a purchased domain. Treat the brand name itself as provisional until that's finalized.

## What's in this repo

This repository contains the Phase 1 marketing and lead-capture site, the canonical Astro + Markdoc decision system, and a provider-neutral orchestration simulation.

Start with [`src/content/docs/index.mdoc`](src/content/docs/index.mdoc) or the rendered `/docs/` route for current status, architecture, product requirements, agent contracts, broker rules, ADRs, roadmap, operations, and provenance.

| Path | What it is |
|---|---|
| `CLAUDE.md` / `AGENTS.md` | Project instructions for AI coding agents (`CLAUDE.md` is a symlink to `AGENTS.md` so both read the same source of truth). |
| `src/content/docs/` | Canonical `.mdoc` business, product, architecture, agent, workflow, governance, ADR, roadmap, operations, and reference pages. |
| `.github/workflows/` / `security/` | Secure delivery definitions and machine-readable dependency, Action, header, data, vulnerability, and exception policy. |
| `src/modules/orchestration/` | Typed translator, Markdoc retrieval, broker, provider adapters, workflows, approvals, audit, and documentation-impact simulation. |
| `src/pages/docs/` / `src/layouts/DocsLayout.astro` | Static Astro documentation route and reading experience. |
| `src/pages/workspace/` | Truthfully labeled in-memory orchestration vertical slice and non-operational queue placeholders. |
| `public/diagrams/` | Preserved Excalidraw sources, package contents, previews, Mermaid sources, and truthful exports. |
| `reference/source-materials/` | Non-destructive source copies, extracted text/packages, hashes, inventories, and assessments. |
| `docs/` / `mkdocs.yml` | Legacy MkDocs handbook retained as migration evidence and an optional legacy build. |
| `docs/brand.md` | Brand tokens — colors, typography, logo usage, voice. |
| `docs/ai-agent-workflow.md` | Low-token handoff workflow for switching between Claude Code and Codex. |
| `reference/v9-source.html` | The original single-file site this Astro project replaces, kept as a content/behavior reference. |
| `public/brand/*.svg` | Source brand identity and logo-showcase sheets. |
| `src/layouts/BaseLayout.astro` | Page shell — nav, sticky contact pill, footer. |
| `src/components/*.astro` | One component per marketing-site section (Hero, Process, Demo, Services, PricingCards, Honest, ContactForm). |
| `src/styles/global.css` | The shared design-system stylesheet. |

## Project status

- **Phase 1.5** (agent platform completion, ADR-0017): implemented and verified `complete-frozen`. The bounded ADR-0023 correction adds an authoritative execution-budget lineage/ledger, atomic model-call and cumulative output-token reservations, monotonic filesystem fencing, independent remote-invocation termination state, direct Claude/Codex HTTP conformance, and pre-execution fail-closed behavior for unresolved invocations and the opaque Codex CLI path. It adds no provider, routing, role-budget, gateway, deployment, or release capability. Full detail: [`plans/phase-1-5-completion-audit`](src/content/docs/plans/phase-1-5-completion-audit.mdoc).
- **Phase 1.6** (Knowledge/Research/Understanding/Decision OS, ADR-0019): authorized, bounded to PR-0. PR-0 part 1 — schemas, events, and typed IDs under `src/modules/orchestration/decision-os/` — is merged. `authority.ts` (the privacy/authority invariants ADR-0019 also scopes into PR-0) is not yet implemented, so PR-0 is not fully closed. Full detail: [`decisions/0019-begin-phase-1-6...`](src/content/docs/decisions/0019-begin-phase-1-6-knowledge-research-understanding-decision-os.mdoc), [`plans/current-phase`](src/content/docs/plans/current-phase.mdoc).

## Development

```sh
npm install
npm run dev      # localhost:4321, hot reload
npm run build    # outputs to dist/ — verify this succeeds before any task is done
npm run preview  # serve the production build locally
npm run typecheck # Astro and TypeScript diagnostics
npm run test # orchestration unit tests
npm run ci:quality # format, lint, type, unit, docs build, and built-link gates
npm run ci:security # secret, dependency, license, and workflow-policy gates
npm run test:browser # Playwright smoke, accessibility, and responsive checks
npm run docs:validate # validate Markdoc, links, sources, diagrams, and search
npm run docs:serve # localhost:8000, hot-reloading canonical handbook
npm run docs:build # validate Markdoc and build the unified Astro site
npm run docs:legacy:build # optional retained MkDocs evidence build
```

Markdoc is installed with the Node dependencies. MkDocs remains pinned in `requirements-docs.txt` only for the optional legacy build. If needed:

```sh
python3 -m pip install -r requirements-docs.txt
```

Every material project change must update the relevant `.mdoc` page. Significant decisions also require one ADR; start at `src/content/docs/decisions/index.mdoc`.

The canonical handbook uses Astro, Markdoc, Beacon brand tokens, a generated client-side search index, preserved Excalidraw/Excalidraw Animate source material, and Mermaid views. It remains readable without JavaScript; JavaScript enhances search, diagram rendering, and the workspace simulation.

## Deploying

The current Cloudflare Worker target is `beaconco9`; `wrangler.jsonc` configures static assets and `/api/contact`. Repository workflows define manual preview, staging, production, and post-deploy stages that promote one tested archive by SHA-256 — this is the only deploy path.

GitHub rulesets, required checks, environments, and a required production reviewer (administrator bypass disabled) are active. Cloudflare's native Git auto-deploy integration for `beaconco9` was disconnected and the disconnect was empirically verified — a merge to `main` produces no Workers Builds check-run and no change to the live production `etag`. Do not reconnect it. Follow `src/content/docs/operations/deployment-runbook.mdoc`.

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

- **Frontend (implemented):** Astro 7 static site → Cloudflare Worker static assets
- **Contact form:** Cloudflare Worker route (`src/worker.ts`) + Turnstile + Resend
- **Documentation (implemented):** Astro + Markdoc source of truth with validated content, ADRs, provenance, search, and diagrams
- **Orchestration (implemented simulation):** typed translator, Markdoc retrieval, broker/router, Claude/Codex prompt adapters, approvals, audit, continuation, workflow gates, and documentation impact
- **Data (planned):** Supabase (Postgres, Storage, Realtime, RLS)
- **Queue (planned):** pg-boss on Postgres
- **AI (planned):** Claude API, versioned prompt registry, output guards
- **Content (planned):** Satori + JSON2Video initially; native Meta/TikTok APIs after platform approval

See `src/content/docs/architecture/overview.mdoc` for the implemented boundary and `src/content/docs/plans/roadmap.mdoc` for phased direction.

## Open items

- [ ] Confirm domain availability for the finalized name via a registrar
- [ ] Run a formal USPTO TESS trademark search before committing
- [ ] Full rename pass across all copy once the name is locked
- [x] Wire up the contact form to a real backend (Cloudflare Worker + Turnstile + Resend)
- [x] Set `PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, and `RESEND_API_KEY` in the Cloudflare dashboard — verified end-to-end (real submission → Turnstile pass → email delivered)
- [x] Disconnect Cloudflare's native Git auto-deploy in favor of the gated, evidence-bound `workflow_dispatch` pipeline — verified (see Deploying)
- [ ] Resend is currently sending from `onboarding@resend.dev` (their shared test address) — verify a custom domain in Resend once one's registered, so it sends from `@beaconandco.com` instead
- [ ] Activate and verify the secure CI/CD GitHub and Cloudflare settings listed in the deployment runbook
- [ ] Triage the current dependency-audit findings and record any temporary exception
<!-- git-integration-disconnect-verify: 2026-08-10T12:51:25Z -->
