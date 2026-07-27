---
title: ADR-0003 — Record the architecture evolution and source atlas
date: 2026-07-26
status: accepted
decision-type: architecture
---

# ADR-0003 — Record the architecture evolution and source atlas

<div class="decision-lede">
  <span class="decision-card__number">ARCHITECTURE DECISION · ACCEPTED</span>
  <p>The system did not begin as a nine-layer platform. It began as one useful local website. This record preserves every stage of that evolution, distinguishes what runs today from what is only proposed, and makes every supplied diagram reachable from one atlas.</p>
</div>

## Decision

Use a phase-gated architecture with a static Astro marketing site as the current product. Add platform layers only when a delivered business workflow proves the need.

Maintain architecture in three complementary forms:

1. **This decision record** explains boundaries, evolution, and status.
2. **Mermaid source** records relationships and sequences in reviewable text.
3. **Excalidraw and extracted SVG source** preserve spatial exploration and proposal evidence.

No diagram makes a future service current. The status labels in this record control that interpretation.

## How the architecture evolved

| Stage | Question | Result | Status |
|---|---|---|---|
| 1. Local observation | Can one useful site improve a real local business’s presence? | A single-file marketing experience and a small offer | Historical evidence |
| 2. Maintainable site | Can the page be changed without editing thousands of lines? | Astro components, plain CSS, static output | Implemented |
| 3. Safe inquiry | Can a visitor contact the founder without turning the site into an application? | One narrow Cloudflare Worker route with validation, Turnstile, and email delivery | Implemented |
| 4. Repeatable delivery | What would support audits, content, approval, publishing, and reports? | Workers, queue, data, external APIs, and observability proposal | Proposed |
| 5. Governed system | How can the project grow without diagrams becoming fiction? | Phase gates, truth labels, source-controlled diagrams, and this atlas | Accepted |

The rule is simple: **the smallest architecture that safely supports the current customer promise wins**.

## Current production-shaped architecture

<span class="truth-state truth-state--current">Implemented in the repository</span>

```mermaid
--8<-- "diagrams/system-architecture.mmd"
```

<figure class="architecture-figure architecture-figure--wide">
  <object data="../../assets/architecture/beacon-system-animated.svg" type="image/svg+xml" aria-label="Animated Beacon current system architecture"></object>
  <figcaption>Animated Excalidraw-derived view. <a href="../../assets/architecture/beacon-system-static.svg">Open the reduced-motion static view</a>.</figcaption>
</figure>

### Current request flow

```text
Visitor
  → Cloudflare edge
  → Astro static assets
  → browser-rendered marketing page

Contact submission
  → POST /api/contact
  → Cloudflare Worker
  → content-type and same-origin checks
  → Turnstile verification
  → honeypot and validation
  → Resend email
  → plain success or failure response
```

The Worker is a narrow deployment function, not the start of an application backend. There is no client database, job queue, admin dashboard, billing automation, content engine, or social publisher in the current repository.

### Current technical boundaries

| Concern | Current decision |
|---|---|
| Web framework | Astro 7.1.3, static output |
| UI runtime | HTML, plain CSS, component-scoped vanilla JavaScript |
| Hosting shape | Cloudflare-compatible static assets and Worker |
| Contact abuse control | same-origin/content-type validation, honeypot, Turnstile |
| Contact delivery | Resend |
| Browser persistence | No `localStorage` or `sessionStorage` |
| Generated people | Prohibited |
| Reduced motion | Required |
| Documentation | MkDocs Material; source files live in this repository |

## Phase boundaries

| Phase | Capability | Architecture allowed |
|---|---|---|
| Phase 1 — now | Marketing, pricing, evidence, contact | Static Astro site and narrow contact Worker |
| Phase 2 | Internal prospect and audit workflow | Add the minimum authenticated data and job capability after schema and security review |
| Phase 3 | Client content approval and recurring delivery | Add client-scoped records, approval state, queues, and publishing adapters |
| Phase 4 | Reporting and scale | Add measured observability, failure recovery, and provider redundancy where operating data justifies it |

These are gates, not calendar promises.

## Proposal architecture: business and system views

The following sources are extracted on every documentation build from the preserved proposal HTML. They are proposal evidence, not current deployment diagrams.

### Business flow

```mermaid
--8<-- "diagrams/proposal/business-flow.mmd"
```

[Open Mermaid source](../diagrams/proposal/business-flow.mmd)

### Full proposed system

```mermaid
--8<-- "diagrams/proposal/full-system-architecture.mmd"
```

[Open Mermaid source](../diagrams/proposal/full-system-architecture.mmd)

### Proposed end-to-end sequence

```mermaid
--8<-- "diagrams/proposal/end-to-end-sequence.mmd"
```

[Open Mermaid source](../diagrams/proposal/end-to-end-sequence.mmd)

## Proposal architecture: eight original visual sources

These SVG files are deterministically extracted from the proposal rather than recreated by eye.

<div class="source-gallery">
  <figure>
    <img src="../../assets/architecture/proposal/business-loop.svg" alt="Proposal diagram showing the repeating Beacon business loop">
    <figcaption><strong>Business loop.</strong> Find, audit, call, build, publish, report, retain.</figcaption>
  </figure>
  <figure>
    <img src="../../assets/architecture/proposal/platform-architecture-sketch.svg" alt="Proposal sketch of platform architecture layers">
    <figcaption><strong>Platform sketch.</strong> Early spatial view of the proposed operating platform.</figcaption>
  </figure>
  <figure>
    <img src="../../assets/architecture/proposal/lead-sequence-sketch.svg" alt="Proposal sketch of the lead and outreach sequence">
    <figcaption><strong>Lead sequence.</strong> Research, qualify, audit, outreach, and call.</figcaption>
  </figure>
  <figure>
    <img src="../../assets/architecture/proposal/full-system-map.svg" alt="Proposal full-system map">
    <figcaption><strong>Full system map.</strong> Expanded services, data, queues, and external integrations.</figcaption>
  </figure>
  <figure>
    <img src="../../assets/architecture/proposal/content-media-pipeline.svg" alt="Proposal content and media pipeline">
    <figcaption><strong>Content and media.</strong> Draft, render, approve, publish, measure.</figcaption>
  </figure>
  <figure>
    <img src="../../assets/architecture/proposal/website-motion-pipeline.svg" alt="Proposal website and motion pipeline">
    <figcaption><strong>Website and motion.</strong> Proposed visual-production tool chain.</figcaption>
  </figure>
  <figure>
    <img src="../../assets/architecture/proposal/attention-before.svg" alt="Proposal attention map before interface simplification">
    <figcaption><strong>Attention before.</strong> Dispersed hierarchy hypothesis.</figcaption>
  </figure>
  <figure>
    <img src="../../assets/architecture/proposal/attention-after.svg" alt="Proposal attention map after interface simplification">
    <figcaption><strong>Attention after.</strong> Concentrated hierarchy hypothesis.</figcaption>
  </figure>
</div>

[Open the extracted-source manifest](../assets/architecture/proposal/source-manifest.json)

## Proposed nine-layer target

<span class="truth-state truth-state--proposed">Proposal target · not implemented</span>

| Layer | Responsibility | Proposal candidates | Gate before adoption |
|---|---|---|---|
| 1. Edge and hosting | DNS, TLS, cache, static delivery, rate limits | Cloudflare Pages/Workers | Current edge needs remain narrow |
| 2. Build and deployment | Build, test, preview, release, rollback | GitHub Actions, Cloudflare deployments | Add automation only when release frequency needs it |
| 3. Ingress and asynchronous work | Validate requests, enqueue long work, isolate retries | API routes, queue abstraction | A workflow must exceed synchronous request safety |
| 4. Workers | Run bounded business jobs | Lead, audit, outreach, site, content, report workers | Each worker needs an owner, idempotency rule, and failure policy |
| 5. AI/model gateway | Route model tasks, validate structured output, track cost | Provider adapters and prompt registry | Real repeated tasks and measurable quality criteria |
| 6. Security and tenancy | Authenticate, authorize, scope secrets and records | Auth, row-level rules, consent/suppression | Required before client data or social tokens |
| 7. Data | Store clients, jobs, approvals, content, metrics, events | PostgreSQL/Supabase proposal | Approve schema and backup/restore model first |
| 8. External APIs | Email, payments, listings, social, analytics, media | Resend, Stripe, Google, Meta, TikTok, media vendors | Revalidate pricing, approval, terms, and token handling |
| 9. Observability | Logs, traces, errors, cost, job health, business outcomes | OpenTelemetry/Sentry-style proposal | Instrument the workflow before choosing a large stack |

No vendor listed above is approved merely by appearing in the proposal. Pricing, capabilities, account approval, data handling, and operational fit change over time and must be verified when the layer becomes current.

## Proposed worker boundaries

| Worker | Input | Responsibility | Durable output |
|---|---|---|---|
| Lead | allowed local sources | normalize, deduplicate, apply suppression and qualification | prospect candidate and evidence |
| Audit | qualified prospect or client | inspect presence and generate an evidence-backed audit | versioned audit |
| Outreach | approved prospect and sequence | schedule compliant messages and record response state | message event and next action |
| Site | approved scope and content | produce or update a client-owned static site | versioned build artifact |
| Content | approved brief and real assets | draft posts and media variants | reviewable content package |
| Report | client metrics and delivered work | summarize outcomes in plain language | monthly report |

Every worker is proposed. “Agent” is not permission to operate autonomously; each has a bounded input, schema, policy, and observable output.

## Proposed data boundaries

The proposal implies the following durable records:

- organizations and people;
- prospects and source evidence;
- suppression and consent state;
- audits and audit versions;
- opportunities and sales activity;
- clients, agreements, products, and subscriptions;
- projects, jobs, attempts, and artifacts;
- content items, media assets, approvals, and publications;
- provider credentials stored as references to secrets, never plaintext records;
- metrics, reports, costs, events, and audit logs.

Before any schema exists, ADR-0001’s business terms and ADR-0002’s experience language remain the naming authority. Data isolation must be client-scoped, and deletion/retention rules must be explicit.

## Queue, retry, and failure rules

When asynchronous work is eventually justified:

- enqueue durable intent before starting expensive work;
- give each job an idempotency key;
- separate retryable provider failures from invalid input;
- cap retries and back off;
- retain a dead-letter or manual-review state;
- never publish content merely because a retry succeeded;
- expose cost, latency, attempts, and final state;
- permit a founder to stop, re-run, or replace a bounded job.

The proposal mentioned `pg-boss`; it is a candidate, not a current selection. The choice should be made when the actual deployment and database constraints are known.

## Content, media, and publishing proposal

```text
Approved brief + real client assets
  → draft structured content
  → create branded derivatives
  → client approval tap
  → publish through an approved adapter
  → record platform response
  → measure
  → report and learn
```

Proposed tool sequence:

- Satori for branded static graphics;
- JSON2Video as an early managed video option;
- Remotion later if volume justifies an owned rendering pipeline;
- Upload-Post as an early publishing abstraction;
- native platform APIs only when reliability, approval, and account access justify their maintenance cost.

Social API access is not assumed. Meta, Instagram, TikTok, and Google capabilities, review processes, allowed automation, quotas, and prices must be revalidated before implementation.

## Security and observability

Future services must add controls with the capability they protect:

- least-privilege provider credentials;
- separate production and preview secrets;
- encrypted storage and rotation;
- client and environment isolation;
- consent and suppression before outreach;
- human approval before publishing;
- audit events for consequential state changes;
- structured logs without raw secrets or unnecessary personal data;
- per-job latency, attempts, provider usage, and cost;
- business measures such as approved content, successful publication, qualified calls, and retained clients.

Do not add an observability stack before there is a system to observe. Do not add a client workflow without its audit trail.

## Excalidraw source atlas

### Current system source

- [Editable current-system Excalidraw](../assets/architecture/beacon-system.excalidraw)
- [Generated animated SVG](../assets/architecture/beacon-system-animated.svg)
- [Generated static SVG](../assets/architecture/beacon-system-static.svg)
- [Current Mermaid source](../diagrams/system-architecture.mmd)

The generation script uses the Excalidraw scene as source and creates a static accessibility fallback. It is influenced by `excalidraw-animate`, while remaining deterministic and locally buildable.

### Supplied AI-company exploration

- [840-element combined Excalidraw canvas](../assets/adr-intake/ai-company/ai_company_all_agents_and_combined_canvas.excalidraw)
- [16-item Excalidraw library](../assets/adr-intake/ai-company/ai_company_all_agents_and_combined.excalidrawlib)
- [Contact sheet](../assets/adr-intake/ai-company/ai_company_all_agents_contact_sheet.png)
- [Instructions for Excalidraw Animate](../assets/adr-intake/ai-company/OPEN_IN_EXCALIDRAW_ANIMATE.txt)

<figure class="architecture-figure architecture-figure--wide">
  <img src="../../assets/adr-intake/ai-company/ai_company_all_agents_contact_sheet.png" alt="Contact sheet showing the supplied AI-company agent architecture diagrams">
  <figcaption>Evidence atlas for the supplied all-agents package. Individual ideas become accepted architecture only when this record says so.</figcaption>
</figure>

### Missing claimed files

The proposal refers to `beacon-and-co-architecture.excalidraw`, `beacon-and-co-sequence.excalidraw`, and `beacon-and-co-flow.excalidraw`. Those three files were not present in the repository or supplied package during this reset. Their eight embedded SVG views and five Mermaid sources are preserved above; the missing editable scenes must not be claimed as available.

## Source maintenance

Run:

```bash
npm run docs:sources
npm run docs:diagrams
npm run docs:build
```

`docs:sources` extracts proposal evidence. `docs:diagrams` also regenerates the current animated/static architecture. `docs:build` runs both before the strict MkDocs build.

A material architecture change must update:

1. this record;
2. the relevant source diagram;
3. `docs/current-state.md`;
4. a change record;
5. the implementation or phase status that makes the diagram truthful.

## Consequences

### Positive

- The project can grow without confusing a proposal with production.
- Every current and supplied architecture view is reachable from one record.
- Text diagrams remain diffable; spatial diagrams remain available for exploration.
- Vendor selection stays close to the phase that bears its cost and risk.

### Trade-offs

- Some proposal diagrams intentionally overlap.
- Extraction and diagram validation add build steps.
- Future work must update documentation before an architecture claim is considered accepted.
- The full target remains incomplete by design.

## Supersedes and sources

This record consolidates the former architecture, framework, deployment, data, queue, media, security, observability, documentation, and diagram ADRs removed during the July 2026 decision-book reset.

Primary sources:

- [`docs/architecture.md`](../architecture.md)
- [Complete business proposal snapshot](../assets/adr-intake/ai-company/beacon-and-co-full-business-proposal.html)
- [Architecture proposal narrative](../proposals/architecture-proposal.md)
- [ADR-0001 — business definition](0001-why-beacon-exists-and-business-definition.md)
- [ADR-0002 — brand and customer experience](0002-define-brand-and-customer-experience.md)

