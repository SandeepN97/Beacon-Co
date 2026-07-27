---
title: Reset the Decision Book and preserve every architecture source
date: 2026-07-26
status: completed
---

# Reset the Decision Book and preserve every architecture source

## Why

The 16-ADR hierarchy split one connected origin story across too many records and left the broad proposal in a separate intake area. Readers could not easily tell which future vendor choices were current, accepted, or merely proposed.

The requested reset starts with why Beacon was built, carries the full business definition forward, then shows how the experience, architecture, and AI-assisted operating model evolved.

## Changed

- Removed the former 16 ADRs and the ADR intake pages.
- Added four canonical decisions in dependency order.
- Preserved the complete renamed proposal and supplied AI-company Excalidraw package.
- Added deterministic extraction of five Mermaid and eight standalone SVG proposal sources.
- Added the complete architecture source atlas to ADR-0003.
- Rebuilt the MkDocs navigation with Start Here, Decisions, Architecture, Reference, and Operations.
- Switched to MkDocs Material and redesigned the handbook using the Beacon forest, sage, gold, cream, ink, and typography system.
- Strengthened primary and nested sidebar contrast.
- Converted current-state, business, architecture, and proposal pages into derived references.
- Updated the Claude/Codex handoff around the four-record source of truth.

## Decision impact

- [ADR-0001](../decisions/0001-why-beacon-exists-and-business-definition.md) now governs business interpretation.
- [ADR-0002](../decisions/0002-define-brand-and-customer-experience.md) now governs experience.
- [ADR-0003](../decisions/0003-record-architecture-evolution-and-source-atlas.md) now governs architecture and diagram maintenance.
- [ADR-0004](../decisions/0004-use-a-durable-ai-assisted-operating-model.md) now governs AI-assisted continuity.

## Verification

- `npm run docs:build` — passed in strict mode.
- `npm run docs:validate` — six Mermaid sources parse; five extracted Mermaid sources match the proposal; eight extracted SVGs parse; 198 animated Excalidraw elements complete in 4.53 seconds; 14 proposal sections, 16 library items, and 840 canvas elements remain intact.
- `npm run docs:validate-built` — seven Mermaid containers, local runtime, all four decision routes, Material theme, and Beacon brand layer confirmed in generated HTML.
- `npm run build` — passed; one Astro static page generated.
- `git diff --check` — passed.
- Headless Chrome desktop review — homepage, high-contrast nested navigation, ADR-0003, rendered Mermaid, animated/static Excalidraw, and proposal evidence visually checked.
- Headless Chrome narrow review — header, title, hero, CTA, spacing, and wrapping checked at 500 × 900.
- Route review — homepage, Decision Book, all four ADRs, architecture, proposal, animated/static SVG, extracted proposal SVG, proposal HTML, and combined Excalidraw canvas returned HTTP 200.
