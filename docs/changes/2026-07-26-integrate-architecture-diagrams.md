---
title: 2026-07-26 — Integrate Excalidraw Animate and Mermaid architecture diagrams
date: 2026-07-26
type: architecture-and-documentation-ui
status: completed
---

# 2026-07-26 — Integrate Excalidraw Animate and Mermaid architecture diagrams

## Summary

Added a reproducible, branded architecture visualization system to the project handbook. The architecture proposal and foundational architecture ADR now show an Excalidraw Animate overview, while Mermaid provides a compact, reviewable statement of the same system relationships.

## Changed

- `docs/assets/architecture/beacon-system.excalidraw` — editable Excalidraw architecture scene.
- `docs/assets/architecture/beacon-system-animated.svg` — generated animated overview.
- `docs/assets/architecture/beacon-system-static.svg` — generated reduced-motion fallback.
- `docs/diagrams/system-architecture.mmd` — maintainable Mermaid system flow.
- `tools/generate-architecture-diagrams.mjs` and `tools/excalidraw-runtime-entry.mjs` — reproducible build-time generation.
- `package.json` and `package-lock.json` — exact development-only diagram generation dependencies and scripts, including a local Mermaid runtime.
- `requirements-docs.txt` and `mkdocs.yml` — pinned Mermaid plugin and branded Mermaid configuration.
- `docs/stylesheets/brand.css` — responsive diagram presentation using the business palette.
- `docs/proposals/architecture-proposal.md`, `docs/architecture.md`, and `docs/decisions/0003-adopt-phased-system-architecture.md` — visual and Mermaid architecture representations.

## Experience and accessibility

- The animation explains system order; it is not decorative.
- A media-aware `<picture>` switches to the equivalent static SVG when reduced motion is preferred.
- Both SVG variants contain a title and description.
- The embedded image has contextual alternative text and an adjacent status explanation.
- Diagram colors reuse the documented forest, sage, gold, cream, and ink system.
- The layout scales within the handbook content width and Mermaid may scroll horizontally on narrow screens.

## Decisions

- [Current ADR-0003 — Architecture evolution and source atlas](../decisions/0003-record-architecture-evolution-and-source-atlas.md)

## Documentation updated

- Current State
- Architecture Proposal
- System Architecture
- Experience Specification
- Documentation Policy
- Decision Register
- Repository README and setup guide

## Implementation impact

Documentation tooling and presentation only. No Phase 2 or Phase 3 service was scaffolded, and no React or diagram runtime was added to the Astro marketing application.

## Validation

- `npm run docs:diagrams` — generated editable, animated, and static assets plus the pinned local Mermaid runtime.
- Repeated diagram generation — byte-for-byte stable checksums.
- Mermaid source parse with Mermaid `11.16.0` — passed.
- Animated/static SVG inspection — 198 animation elements, a 4.53-second full sequence, and no animation elements in the static fallback.
- Static architecture SVG raster render and visual inspection — passed.
- Headless Chrome render of the architecture proposal — animated SVG loaded and Mermaid rendered with the local bundle.
- `npm run docs:build` — passed in strict mode.
- `npm run build` — passed; one static application page generated.
- Architecture proposal, ADR-0003, ADR-0016, SVG, Excalidraw, and local Mermaid routes — HTTP 200.
- `git diff --check` — passed.

## Follow-up

- Keep the Mermaid and Excalidraw representations semantically aligned when architecture boundaries change.
