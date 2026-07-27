---
title: 2026-07-26 — Apply the Beacon & Co. documentation theme
date: 2026-07-26
type: product-ui-and-documentation
status: completed
---

# 2026-07-26 — Apply the Beacon & Co. documentation theme

## Summary

Applied the established Beacon & Co. visual system to the MkDocs handbook so project plans, ADRs, change records, and agent workflow guidance feel like one coherent business source of truth.

## User problem and expected outcome

The handbook used the unmodified Read the Docs appearance and felt disconnected from the marketing experience. Readers should now recognize the same forest, sage, gold, cream, ink, typography, and restrained editorial character while retaining the clarity expected from technical documentation.

## Changed

- `mkdocs.yml` — loads the shared documentation stylesheet and lists this change in navigation.
- `docs/stylesheets/brand.css` — brands global navigation, search, typography, content, code, tables, notices, focus states, and responsive behavior.
- `docs/product/experience-specification.md` — defines the documentation experience requirements.
- `docs/current-state.md` — records the implemented handbook generator, theme, local origin, and output.
- `docs/changes/index.md` — registers this delivered change.

## Decisions

No new architecture direction was introduced. The implementation applies the accepted brand and accessibility rules from [Brand System](../brand.md), [Experience Specification](../product/experience-specification.md), and the current [ADR-0002](../decisions/0002-define-brand-and-customer-experience.md).

## CTA impact

None. The project handbook is an internal planning and delivery surface, not a marketing conversion surface.

## Accessibility and motion

- Link color uses the darker forest family for readable body contrast while gold remains an underline and focus accent.
- Search, current navigation, code, table headers, and footer controls maintain visible foreground/background separation.
- All interactive elements receive a gold `:focus-visible` outline.
- Narrow layouts preserve horizontal access to wide tables.
- A reduced-motion rule disables smooth scrolling and minimizes any inherited transitions or animations.

## Responsive behavior

- Desktop retains a branded fixed documentation sidebar and a readable content measure.
- Tablet reduces content gutters without changing information hierarchy.
- Mobile uses the Read the Docs navigation drawer, compact content gutters, fluid headings, and horizontally scrollable tables.

## Validation

- `npm run docs:build` — passed in strict mode.
- `npm run build` — passed; one static application page generated.
- `http://127.0.0.1:8000/ai-agent-workflow/` — returned HTTP 200.
- `http://127.0.0.1:8000/stylesheets/brand.css` — returned HTTP 200 after the local documentation server restarted.
- Generated HTML — references the branded stylesheet and retains the workflow page title, navigation state, headings, lists, links, and code samples.

## Follow-up

- Use this global theme for future documentation instead of page-specific styling.
- Recheck the rendered handbook whenever MkDocs or the Read the Docs theme is upgraded.
