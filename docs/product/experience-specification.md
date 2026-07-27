---
title: Product and UI Experience Specification
date: 2026-07-26
---

# Product and UI Experience Specification

## Purpose

The marketing site should turn a local small-business owner's uncertainty about digital marketing into one clear next action: request a free audit.

## Current page structure

| Order | Section | Source | Primary role |
|---:|---|---|---|
| 1 | Hero | `src/components/Hero.astro` | State the local promise and establish founder trust |
| 2 | Process | `src/components/Process.astro` | Explain how engagement works |
| 3 | Interactive demo | `src/components/Demo.astro` | Make the service outcome concrete |
| 4 | Services | `src/components/Services.astro` | Explain available work in plain language |
| 5 | Pricing | `src/components/PricingCards.astro` | Present transparent packages and comparison |
| 6 | Honest/how-we-work | `src/components/Honest.astro` | Set expectations and differentiate the operating model |
| 7 | Contact | `src/components/ContactForm.astro` | Capture the audit request |
| Shared | Navigation/footer | `src/layouts/BaseLayout.astro` | Orientation, trust, and repeated access to the primary conversion |

## Experience rules

These are accepted product constraints:

- Put the core promise in the top-left high-value reading area.
- Use short paragraphs, meaningful headings, and deliberate hierarchy.
- Maintain one dominant CTA per screen.
- Do not place decorative badges or competing secondary buttons near a CTA.
- Use real local photography when photography is available.
- Never use AI-generated stock people or avatars.
- Use labeled neutral placeholders when real imagery is unavailable.
- Respect `prefers-reduced-motion` for every animation.
- Keep state in memory or build-time data; never use `localStorage` or `sessionStorage`.
- Preserve useful behavior without introducing a client framework runtime.

See [ADR-0002](../decisions/0002-define-brand-and-customer-experience.md).

## CTA model

The dominant conversion is **Free Audit**. Navigation, services, pricing, and the sticky contact pill may provide access to the same conversion, but a viewport must not present multiple competing actions with equal visual weight.

Before adding or changing a CTA:

1. Identify the one action the viewport should prioritize.
2. Reduce or demote nearby alternatives.
3. Verify mobile and desktop hierarchy.
4. Update this specification and the change record.

## Interaction model

- Navigation links scroll to page sections.
- Scroll position updates navigation state.
- The sticky contact pill appears after the visitor moves beyond the initial page area.
- The demo advances through a staged transformation.
- Section content reveals progressively while respecting reduced-motion preferences.
- Contact submission occurs without a full-page navigation.
- Contact errors are shown next to the form and Turnstile is reset after failure.

## Accessibility baseline

Every UI change must consider:

- semantic headings and landmarks;
- visible keyboard focus;
- keyboard-operable controls;
- form labels and useful errors;
- sufficient color contrast;
- reduced-motion behavior;
- responsive reading order;
- text alternatives for meaningful images;
- no essential instruction conveyed by color alone.

The repository does not currently include an automated accessibility test suite. Browser and accessibility validation should be recorded in each material UI change.

## Responsive baseline

Changes must be checked at minimum for:

- narrow mobile;
- wide mobile/small tablet;
- desktop;
- long or zoomed text;
- touch and keyboard interaction where relevant.

## Brand implementation

The authoritative tokens and logo rules are in [Brand System](../brand.md). UI code should consume the established CSS custom properties instead of introducing parallel token systems.

### Documentation experience

The project handbook is part of the Beacon & Co. product experience. Its MkDocs theme must:

- use the established forest, sage, gold, cream, ink, muted, and rule colors;
- use the established display, body, and label type families;
- favor long-form readability over marketing-page decoration;
- maintain strong link, navigation, search, and keyboard-focus contrast;
- present expanded sidebar subsections on an explicit dark-forest panel with high-contrast labels and unmistakable current, hover, and focus states;
- keep tables and code samples usable on narrow screens;
- limit animation to information-bearing architecture sequences and native navigation behavior;
- replace animated architecture SVGs with an equivalent static SVG when `prefers-reduced-motion` is enabled;
- give meaningful diagrams equivalent alternative text, an SVG title and description, and an adjacent factual explanation;
- keep Excalidraw and Mermaid diagrams within the established forest, sage, gold, cream, ink, and rule palette;
- apply globally so every ADR, plan, change record, and agent handoff reads as one source of truth.

The handbook presentation is implemented in `docs/stylesheets/brand.css` and loaded by `mkdocs.yml`. Architecture diagram sources, generated assets, and maintenance rules are recorded in [ADR-0003](../decisions/0003-record-architecture-evolution-and-source-atlas.md).

## UI change record

A material UI change must record:

- affected component paths;
- user problem and expected outcome;
- CTA impact;
- accessibility and reduced-motion impact;
- responsive behavior;
- verification and screenshots when useful.

Follow the [Documentation Policy](../governance/documentation-policy.md).
