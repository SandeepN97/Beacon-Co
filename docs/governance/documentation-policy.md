# Documentation Policy

## Purpose

The Decision Book is project memory. A material change is incomplete when the repository, business, and handbook disagree.

## Canonical order

1. [ADR-0001](../decisions/0001-why-beacon-exists-and-business-definition.md) — why Beacon exists and how the business works;
2. [ADR-0002](../decisions/0002-define-brand-and-customer-experience.md) — how Beacon looks, sounds, and behaves;
3. [ADR-0003](../decisions/0003-record-architecture-evolution-and-source-atlas.md) — how the system evolved, what runs, and what remains proposed;
4. [ADR-0004](../decisions/0004-use-a-durable-ai-assisted-operating-model.md) — how people and AI collaborators continue the work.

[Current Truth](../current-state.md) is the verified implementation summary. Domain pages are short derived references. The preserved proposal is evidence, not a competing authority.

## Truth labels

| Label | Meaning |
|---|---|
| Implemented | Verified in code, configuration, build, or deployment evidence |
| Accepted | Governing direction or requirement |
| Proposed | Future direction requiring revalidation and authorization |
| Evidence | Preserved observation, claim, artifact, or hypothesis |

Do not use “accepted” to imply that code exists.

## What a material change updates

| Change | Required documentation |
|---|---|
| Business, audience, offer, price, economics, or process | ADR-0001 or a new superseding ADR; business reference; change record |
| Brand, UI hierarchy, CTA, copy rule, accessibility, imagery, or motion | ADR-0002 or a new superseding ADR; experience/brand reference; change record |
| Platform, dependency, deployment, data, security, integration, or phase boundary | ADR-0003 or a new superseding ADR; current truth/architecture; diagram source; change record |
| Claude/Codex handoff, prompting, review, release, or agent governance | ADR-0004 or a new superseding ADR; workflow/handoff; change record |
| Implementation within an accepted direction | Current Truth or domain reference; change record |
| Mechanical cleanup with no behavioral meaning | Nearest change record |

Create a new ADR when the existing decision would become misleading if edited in place. Mark the prior record superseded and link both.

## Evidence requirements

Separate:

- implemented facts;
- governing requirements;
- proposed targets;
- source evidence and assumptions.

Use dates for prices and time-sensitive claims. Link to stable repository evidence. Never include secrets, private client data, or credentials.

For material UI work, record desktop, mobile, keyboard, focus, reduced-motion, and CTA hierarchy checks.

For architecture work:

- keep editable source beside generated output;
- use Mermaid for reviewable relationships and Excalidraw/SVG for spatial evidence;
- label current and proposed boundaries;
- regenerate derived assets;
- update ADR-0003 when meaning changes.

## Definition of done

1. Work or decision is complete.
2. The controlling ADR remains accurate.
3. Current Truth and relevant derived reference agree.
4. Diagram sources agree where architecture changed.
5. A dated change record exists.
6. Relevant application checks pass.
7. `npm run docs:build` passes.

