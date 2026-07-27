---
title: 2026-07-26 — Improve handbook subnavigation and verify proposal diagrams
date: 2026-07-26
type: product-ui-and-documentation-integrity
status: completed
---

# 2026-07-26 — Improve handbook subnavigation and verify proposal diagrams

## Summary

Strengthened the contrast and hierarchy of expanded handbook subnavigation, embedded the complete interactive proposal in its ADR intake, and added a repeatable integrity check for the architecture and proposal assets.

## User problem and expected outcome

Expanded page headings such as “Start here” inherited a pale theme background while retaining light text, making the local handbook difficult to scan. Readers also needed direct evidence that the proposal was complete and that its architecture diagrams still worked.

The expanded submenu now uses an explicit dark-forest panel with high-contrast labels. The intake displays the full proposal in place as well as linking to the full-width view, and documentation builds fail if the controlled diagram or proposal inventory becomes incomplete or invalid.

## Changed

- `docs/stylesheets/brand.css` — gives expanded submenu levels a dark background, stronger text, gold hierarchy line, and clearer current, hover, and focus states; adds responsive styling for the proposal embed.
- `docs/product/experience-specification.md` — records the expanded-subnavigation contrast requirement.
- `docs/decisions/intake/ai-company-agent-operating-model.md` — embeds the complete interactive proposal and records automated completeness evidence.
- `tools/validate-documentation-assets.mjs` — validates Mermaid syntax, Excalidraw scenes, generated SVG accessibility and animation behavior, proposal structure, artifact hashes, and contact-sheet dimensions.
- `package.json`, `README.md`, `SETUP.md`, and `docs/current-state.md` — expose the validation command and run it before documentation serve/build.
- `docs/changes/index.md` and `mkdocs.yml` — register this delivery.

## Decisions

No new architecture or business direction was selected. The navigation treatment implements the accepted brand and accessibility requirements. The proposal remains intake evidence under review; embedding it does not accept its factual, financial, technical, or operational claims.

## CTA impact

None. This is an internal documentation surface.

## Accessibility and motion

- Expanded submenu labels use high-contrast cream text on deep forest instead of light text over a pale inherited background.
- Current submenu items retain dark text on cream with a gold left rule.
- Hover and keyboard focus use a stronger sage panel and gold rule; the global gold focus outline remains intact.
- Generated animated architecture SVGs continue to have a complete static reduced-motion alternative.
- The embedded proposal has a descriptive title and a full-page link immediately above it.

## Responsive behavior

The same navigation contrast applies to the Read the Docs mobile drawer. The proposal embed fills the available content width and uses a shorter minimum height on narrow screens.

## Verification

- `npm run docs:validate` — passed: six Mermaid sources, a 198-element animation completing in 4.53 seconds, 14 proposal sections, eight proposal SVGs, 16 Excalidraw library diagrams, and 840 canvas elements.
- `npm run docs:build` — passed in strict mode.
- `npm run build` — passed.
- Headless browser checks — the nested submenu rendered with high contrast, Mermaid rendered the complete system flow, and the animated Excalidraw SVG reached its complete final frame.
- Generated intake HTML — contains the full proposal iframe with a descriptive title and adjacent full-page link.
- Local routes for the handbook, architecture proposal, ADR intake, proposal artifact, generated SVGs, Mermaid runtime, canvas, library, and contact sheet — HTTP 200.
- `git diff --check` — passed.

## Follow-up

Re-run the documentation build whenever the proposal snapshot, Excalidraw source, Mermaid source, or theme dependency changes.
