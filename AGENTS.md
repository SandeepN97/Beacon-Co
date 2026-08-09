# Beacon & Co. — Project Instructions

Digital presence agency for small businesses within 30 miles of Waynesboro, VA. Solo-operator business, automated end-to-end except two human touchpoints: the sales call and the content-approval tap.

## Current phase: Phase 1 — Marketing and lead capture

The Astro marketing site and one narrow Cloudflare Worker contact route are implemented. Current work may maintain those surfaces, but no database, queue, admin dashboard, or automation workers may be scaffolded speculatively. Those systems remain later-phase plans until the user explicitly authorizes implementation.

## Project source of truth

The published Astro + Markdoc decision system begins at `src/content/docs/index.mdoc` and renders at `/docs/`.

- Read `src/content/docs/plans/current-phase.mdoc` before changing implementation or reporting project status.
- Read the relevant pages in `src/content/docs/architecture/` before an architectural, structural, or phase-sequencing decision.
- Read `src/content/docs/product/principles.mdoc`, `src/content/docs/product/scope-and-non-goals.mdoc`, and `docs/brand.md` before any UI, interaction, copy hierarchy, or styling change.
- Read the relevant product and plan pages before changing an offer, price, guarantee, audience, business process, or business claim.
- Read `src/content/docs/decisions/index.mdoc` for existing decisions and `src/content/docs/governance/` for operating rules.
- Read `src/content/docs/security/secure-development-standard.mdoc` and the relevant security/runbook page before changing workflows, dependencies, the contact route, deployment configuration, or security-critical paths.
- Treat ADR-0001 (business), ADR-0002 (design), and ADR-0003 (architecture evolution) as foundation decisions.
- Every material change must update the relevant `.mdoc` page. Significant choices also require one reviewable ADR.
- Keep planned and implemented state distinct. Documentation of a future component never authorizes its implementation.
- The older `docs/` MkDocs handbook is retained as migration evidence and a legacy build; it is not the canonical current source.

## Stack for this phase

- **Astro 7.1.3**, static output — no SSR adapter
- **Cloudflare Worker** with static assets and the existing `/api/contact` route
- Plain CSS (the existing design already has a clean token system — don't introduce Tailwind or a CSS-in-JS library)
- Vanilla JS scoped per-component via `<script>` tags — no framework runtime (no React, no Vue) for this static site
- **Astro Markdoc** and Astro content collections for the canonical project handbook
- **MkDocs 1.6.1** retained only for the legacy handbook build

## Source material

`reference/v9-source.html` is the original single-file site (~3,350 lines) that the Astro project replaced. It remains the migration baseline for content and behavior; do not redesign or rewrite it without an explicit request and documentation of the resulting change.

## Non-negotiables

- **No `localStorage`/`sessionStorage`** anywhere — not supported in some deploy targets this project may later use. Keep all state in memory or in Astro's build-time data.
- **No AI-generated stock photos or avatars** in any placeholder content — real local photography only, even as placeholders (use clearly-labeled gray boxes instead of fake AI faces).
- One clear call-to-action per screen — no competing secondary buttons or decorative badges near a CTA (this is a deliberate experience rule, not a style preference — see `docs/product/experience-specification.md` and ADR-0002).
- Every animation respects `prefers-reduced-motion`.

## Build & verify

```bash
npm run dev      # localhost:4321, hot reload
npm run build     # outputs to dist/ — verify this succeeds before considering any task done
npm run preview   # serve the production build locally
npm run docs:serve # documentation preview on localhost:8000
npm run docs:validate # validate Markdoc metadata, links, sources, diagrams, and search
npm run typecheck # Astro and TypeScript diagnostics
npm run test      # orchestration unit tests
npm run docs:build # validate canonical docs and build the Astro site
npm run ci:quality # complete repository quality gate
npm run ci:security # secret, dependency, license, and workflow-policy gates
npm run test:browser # smoke, accessibility, and responsive browser checks
```

Run `npm run docs:build` after every material project change. Run `npm run typecheck` and `npm run test` after orchestration or structural changes. Do not report completion while a required check fails.

## Cross-agent continuity

- `CLAUDE.md` must remain a symlink to this file so Claude Code and Codex share one durable instruction source.
- `.ai/handoff.md` is the local, ignored checkpoint for unfinished work. Read it only when the user asks to continue, resume, recover, or switch agents.
- When the user asks for a handoff, replace that file using `.ai/handoff.template.md`. Keep it under 60 lines and include only verified state, decisions, changed paths, validation, blockers, and the exact next action.
- `.ai/handoff-<timestamp>.md` is a separate, timestamped variant: the invoking context writes one, in the same `.ai/handoff.template.md` shape, when token-auditor's capacity check (see Agent Workflow below) routes a provider switch. It's triggered by capacity, not a user request. When resuming after a provider switch, read the most recent `.ai/handoff-*.md` before doing anything else.
- Never paste full chat transcripts, large logs, or full diffs into a handoff. Git and the working tree are the source of truth.

## Compact instructions

When compacting context, preserve the objective, hard constraints, decisions and reasons, exact changed paths, validation outcomes, blockers, and next action. Drop exploratory discussion, repeated instructions, and raw command output.

## Commit style

Small, single-purpose commits. One component migrated per commit where practical, not one giant "port the whole site" commit.

## Agent Workflow

Beacon-Co's agent set is fixed at 8 roles for this repo's current stage:
chief-of-staff, market-researcher, codebase-researcher, code-writer,
qa-engineer, pr-reviewer, release-manager, token-auditor. None of the 8
may invent a 9th — a gap that needs one is reported and stopped on, not
worked around.

**Entry point.** chief-of-staff is the default entry for any ambiguous
or multi-step request. It either answers directly (for questions
`src/content/docs/` already answers) or returns an ordered delegation
plan across the other 6 execution/review roles.

**Ahead of every invocation.** token-auditor runs before any other
subagent is invoked — including chief-of-staff's own downstream steps.
It:
1. Estimates the incoming prompt's token cost and tightens it via its
   six ordered compression tactics — tactic 0 checks whether
   `.beacon/context-primer.md` already answers the orientation question
   before assembling that context from scratch.
2. Checks a caller-supplied capacity signal (Claude session near/at its
   usage limit, or a Codex CLI rate-limit/quota error) before task-type
   fit, and routes to the other provider when capacity is the deciding
   factor — logging the reason as `capacity` or `task-fit`.
3. On a capacity-driven route, also drafts a filled handoff document in
   `.ai/handoff.template.md`'s shape (the real business goal, not just
   the immediate task, plus current state/decisions/changed
   paths/next-step/blockers).

token-auditor never persists anything itself — no `Write`/`Edit`/`Bash`.
The invoking context appends its log line to
`.beacon/telemetry/token-audit.log` and, on a capacity-driven route,
writes the drafted handoff to `.ai/handoff-<timestamp>.md` — distinct
from the single `.ai/handoff.md` checkpoint under Cross-agent
continuity above, which is a user-requested resume point, not a
capacity-routing artifact.

**Orientation.** All 8 agent files read `.beacon/context-primer.md`
first, before task-specific exploration — a short, hand-maintained
summary, not a substitute for reading the actual source file a task
needs.

**Everything else.** codebase-researcher traces existing behavior
before code-writer changes it; code-writer implements one scoped
change in an isolated worktree; qa-engineer verifies with this repo's
real commands; pr-reviewer is the actual human-equivalent review gate
(`required_approving_review_count` is 0 on `main`); release-manager
walks a reviewed commit through the real `workflow_dispatch` deploy
path. market-researcher is typically a terminal step for external or
business questions, not part of the code-change chain.
