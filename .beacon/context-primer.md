# Beacon & Co. — Context Primer

Hand-maintained, not auto-generated. Read this first for orientation;
go to the cited source for anything it doesn't answer. If this file's
last edit is >30 days old, or it contradicts something you just read
fresh, flag the discrepancy — don't trust it blindly.

## What Beacon & Co. is

A solo-operator digital-presence agency for small businesses within
~30 miles of Waynesboro, VA. Automated end-to-end except two human
touchpoints: the sales call and the content-approval tap.

## Current phase

Phase 1.5 — agent platform completion. The implemented product remains
the Phase 1 Astro marketing site and one narrow Cloudflare Worker contact
route (`/api/contact`). Current priority is the measurable agent,
context, routing, policy, eval, and release-evidence platform in
ADR-0017. Major business-domain and UI expansion stays paused until its
completion gate passes. No database, durable queue, admin dashboard,
customer portal, billing surface, or automation worker may be
scaffolded speculatively, and the current broker remains a simulation.

M1 and PR-A through PR-I are implemented locally: fixed contracts,
telemetry, deterministic context compilation, eval fixtures, tool policy,
provider adapters, risk/council logic, tuning guardrails, agent CI, signed
provenance definitions, same-artifact promotion, verification, and rollback.
The PR-J audit reports `localReady: true` and `externalReady: false`.
Representative live run/baseline records, the new required GitHub check,
non-bypassable production approval, real attestation/promotion evidence,
and a rollback drill remain hard gates. Phase 1.5 is not frozen.

## Tech stack

Astro, static output, no SSR adapter, deployed as a Cloudflare Worker
with static assets. Plain CSS token system — no Tailwind, no
CSS-in-JS. Vanilla JS per-component `<script>` tags — no framework
runtime. Astro Markdoc + content collections for the canonical
handbook. MkDocs 1.6.1 retained only for the legacy handbook build.

## Where docs/decisions live

`src/content/docs/` is the source of truth, rendered at `/docs/`. Key
paths: `decisions/` (ADRs; `index.mdoc` lists them), `architecture/`,
`product/` (principles, scope/non-goals), `plans/`
(`current-phase.mdoc`), `governance/`, `security/`
(`secure-development-standard.mdoc`), `agents/` (per-role docs pages).
ADR-0001 (business), ADR-0002 (design), ADR-0003 (architecture
evolution) are foundation decisions.

## The 8-role agent set (`.claude/agents/*.md`)

1. **chief-of-staff** — default entry point; turns an ambiguous or
   multi-step request into a delegation plan or a direct sourced answer.
2. **market-researcher** — external/business research (competitor
   pricing, positioning) within the ~30-mile radius; reports, never edits.
3. **codebase-researcher** — traces existing code behavior with
   `file:line` citations before code-writer touches anything; read-only.
4. **code-writer** — implements one already-scoped change in an isolated
   worktree; never merges or pushes.
5. **qa-engineer** — runs this repo's real test/quality commands against
   a diff; verifies, doesn't fix.
6. **pr-reviewer** — the actual human-equivalent review gate
   (`required_approving_review_count` is 0 on `main`); reviews, never
   approves or merges.
7. **release-manager** — walks a merged commit through the real
   `workflow_dispatch` deploy path; never deploys locally.
8. **token-auditor** — conditionally handles budget breaches, material
   duplication, routing ambiguity, unusual context growth, or provider
   capacity/fallback events. Deterministic preflight handles normal
   inventory, estimation, deduplication, and stable prompt compilation.

The role set is fixed at 8 for this stage — none of the 8 may invent a
9th.

## Deploy path (3 environments)

`pr-quality.yml` builds and attests once → `deploy-staging.yml` verifies
and promotes that artifact → `post-deploy-verify.yml` records staging →
`deploy-production.yml` promotes the same artifact under the production
environment → `post-deploy-verify.yml` records production.
`rollback-production.yml` restores a verified known-good artifact.
These are manual GitHub Actions workflows—never local `wrangler deploy`.
Production currently has no required reviewer and permits admin bypass,
so the required external human gate is not yet active.
