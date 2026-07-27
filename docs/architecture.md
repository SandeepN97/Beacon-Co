---
title: Current Architecture
date: 2026-07-26
---

# Current Architecture

This is the implementation quick reference. [ADR-0003](decisions/0003-record-architecture-evolution-and-source-atlas.md) is the authoritative architecture history, target, phase model, and source atlas.

## Implemented boundary

```mermaid
--8<-- "diagrams/system-architecture.mmd"
```

```text
Visitor browser
  → Cloudflare Worker: beaconco9
      ├─ ordinary request → Astro static assets from dist/
      └─ POST /api/contact
           → origin and field validation
           → Turnstile verification
           → Resend notification
```

The contact route does not create a lead record, enqueue work, or provision later-phase infrastructure.

## Current components

| Component | Responsibility | Source |
|---|---|---|
| Astro page | Static marketing experience | `src/pages/index.astro` |
| Components | Hero through contact sections | `src/components/` |
| Layout | Navigation, document shell, footer | `src/layouts/BaseLayout.astro` |
| CSS | Shared tokens and responsive behavior | `src/styles/global.css` |
| Contact Worker | Validation, Turnstile, email delivery | `src/worker.ts` |
| Deployment config | Worker and static asset binding | `wrangler.jsonc` |

## Current constraints

- no frontend framework runtime;
- no `localStorage` or `sessionStorage`;
- no generated people;
- one clear primary action per screen;
- reduced motion for every animation;
- no speculative data, queue, dashboard, or worker services.

## Proposed boundary

Everything after the marketing site and contact notification is proposed. The complete nine-layer target, workers, data boundaries, failure model, security, observability, media pipeline, provider caveats, and every source diagram live in [ADR-0003](decisions/0003-record-architecture-evolution-and-source-atlas.md).

| Gate | Capability |
|---|---|
| Phase 2 | Minimum durable prospect/audit workflow after schema and security review |
| Phase 3 | Client approval and recurring delivery |
| Phase 4 | Reporting, recovery, and provider redundancy justified by operating evidence |

These gates are not delivery dates and do not approve the proposal’s vendor list.

## Architecture source commands

```bash
npm run docs:sources
npm run docs:diagrams
npm run docs:validate
```

Generated files must not be edited by hand.
