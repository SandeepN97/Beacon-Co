---
title: Current Truth
date: 2026-07-26
---

# Current Truth

This page is the compact, verified repository baseline as of **July 26, 2026**. Decisions explain why; this page says what exists.

## Business

| Item | Current truth |
|---|---|
| Working name | Beacon & Co.; still provisional pending formal clearance |
| Model | Solo-operated digital-presence service |
| Service area | Roughly 30 miles from Waynesboro, Virginia |
| Human decisions | Founder sales conversation; client approval before drafted content is published |
| Primary conversion | Free digital-presence audit |
| Current public prices | Spark $299; sites from $799; Presence $450/mo + setup; Authority $750/mo + setup |
| Delivery | Founder-led; proposed automation is not implemented |

[ADR-0001](decisions/0001-why-beacon-exists-and-business-definition.md) is the complete business definition, including all proposal market evidence, prospects, competitors, offers, economics, roadmap, and risks.

## Marketing site

<span class="truth-state truth-state--current">Implemented</span>

| Item | Current truth |
|---|---|
| Framework | Astro `^7.1.3` |
| Output | Static |
| UI | Plain CSS and component-scoped vanilla JavaScript |
| Framework runtime | None |
| Page count | One marketing page |
| Entry | `src/pages/index.astro` |
| Shared layout | `src/layouts/BaseLayout.astro` |
| Global styles | `src/styles/global.css` |
| Content/behavior baseline | `reference/v9-source.html` |

Rendered sections:

1. hero;
2. process;
3. interactive demo;
4. services;
5. pricing;
6. honest/how-we-work;
7. contact;
8. shared navigation and footer.

[ADR-0002](decisions/0002-define-brand-and-customer-experience.md) governs the brand, CTA hierarchy, imagery, accessibility, and motion.

## Contact and deployment

<span class="truth-state truth-state--current">Implemented</span>

```text
Browser form
  → POST /api/contact
  → Cloudflare Worker
  → origin, content-type, honeypot, and field validation
  → Cloudflare Turnstile
  → Resend email
  → JSON result
```

| Item | Current truth |
|---|---|
| Cloudflare Worker | `beaconco9` |
| Configuration | `wrangler.jsonc` |
| Static binding | `dist/` |
| Route source | `src/worker.ts` |
| Public site key | `PUBLIC_TURNSTILE_SITE_KEY` |
| Runtime secrets | `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY` |
| Runtime configuration | `CONTACT_TO_EMAIL`, `ALLOWED_ORIGIN` |
| Known limitation | Resend shared sender remains until a custom domain is verified |

Repository history records one successful real contact submission and delivered message.

## Decision book and architecture sources

<span class="truth-state truth-state--current">Implemented</span>

| Item | Current truth |
|---|---|
| Generator | MkDocs `1.6.1` |
| Theme | MkDocs Material `9.7.1` with Beacon brand layer |
| Canonical decision set | Four records: business, experience, architecture, operations |
| Proposal evidence | Preserved 14-section interactive HTML snapshot |
| Mermaid | One current system source plus five proposal-derived sources |
| Proposal SVG | Eight deterministically extracted source views |
| Excalidraw | Current system scene, 840-element exploration canvas, and 16-item library |
| Diagram generation | `npm run docs:diagrams` |
| Validation | `npm run docs:validate` |
| Strict build | `npm run docs:build` |
| Local origin | `http://127.0.0.1:8000/` while the docs server runs |

[ADR-0003](decisions/0003-record-architecture-evolution-and-source-atlas.md) is the canonical architecture record and complete diagram atlas.

## AI-assisted continuity

<span class="truth-state truth-state--accepted">Accepted</span>

Claude Code and Codex share repository memory through `AGENTS.md`, `.ai/handoff.md`, the Decision Book, and deterministic verification. No autonomous broker or memory backend exists.

[ADR-0004](decisions/0004-use-a-durable-ai-assisted-operating-model.md) defines the switching and token-use model.

## Explicitly not implemented

<span class="truth-state truth-state--proposed">Proposed</span>

- client or prospect database;
- Supabase, PostgreSQL, row-level security, or object storage;
- pg-boss or another durable job queue;
- authenticated admin dashboard;
- lead, audit, outreach, site, content, or reporting workers;
- AI provider gateway or prompt registry;
- automated image/video production;
- social publishing adapters;
- billing automation;
- production observability stack;
- OAuth token vault or refresh workers.

Do not scaffold these without an explicit phase decision and implementation request.

## Verification baseline

| Check | Current baseline |
|---|---|
| `npm run build` | Required after structural application changes |
| `npm run docs:validate` | Required after proposal or diagram changes |
| `npm run docs:build` | Required after material documentation changes |
| Browser review | Required for material handbook or marketing UI changes |
| Automated application tests | No test suite is configured |

## Open risks

- The name and domain remain provisional.
- Formal trademark clearance remains outstanding.
- The email sender needs a verified custom domain.
- Market figures, competitor comparisons, vendor capabilities, and proposal economics require revalidation before public or financial use.
- Margins and capacity are assumptions until delivery data exists.

