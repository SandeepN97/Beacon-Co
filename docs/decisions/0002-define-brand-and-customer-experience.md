---
title: ADR-0002 — Define the brand and customer experience
date: 2026-07-26
status: accepted
decision-type: experience
---

# ADR-0002 — Define the brand and customer experience

<div class="decision-lede">
  <span class="decision-card__number">EXPERIENCE DECISION · ACCEPTED</span>
  <p>Beacon should feel like a capable local person who explains the work clearly—not a distant agency, a software dashboard, or a collection of marketing tricks. The design earns attention through hierarchy, restraint, and proof.</p>
</div>

## Decision

Use one coherent brand and interaction system across the marketing site, documentation, audits, proposals, reports, and future client surfaces.

The experience will:

- lead with a plain-language promise;
- present one primary action per screen;
- use short, scannable copy and evidence close to the claim it supports;
- use real local photography or clearly labeled neutral placeholders, never generated people;
- avoid attention-stealing badges or competing buttons around the primary action;
- preserve accessibility, client ownership, and honest status language;
- treat motion as explanation or feedback, never decoration that blocks comprehension.

The canonical implementation tokens live in [`docs/brand.md`](../brand.md). This record explains why they exist and how to decide when the interface changes.

## How the design emerged

The business began with a trust problem. The local businesses Beacon wants to help often have a stronger real-world reputation than their online presence communicates. A visually loud “growth agency” treatment would repeat that mismatch in the other direction: a polished promise without enough proof.

The design therefore evolved around four ideas:

1. **Local, not provincial.** Warm and grounded, but professionally composed.
2. **Direct, not simplistic.** Plain language with enough detail to make trade-offs visible.
3. **Premium, not extravagant.** Editorial typography, generous space, and restrained color instead of ornamental effects.
4. **Automated, not impersonal.** Software can prepare and coordinate work; the founder and client retain the consequential decisions.

## Brand system

### Color

| Token | Value | Use |
|---|---|---|
| Forest | `#2a4228` | Primary brand field, headings, navigation, strong controls |
| Deep forest | `#1f321e` | High-contrast navigation and dark surfaces |
| Sage | `#7a9e72` | Supporting accent, calm state, diagram grouping |
| Sage dark | `#55754f` | Accessible links and secondary emphasis |
| Gold | `#c49a48` | Focus, key rule, small highlight; not a large text color |
| Cream | `#fdfcf8` | Main page field |
| Cream deep | `#f5f1e7` | Secondary panels and grouped content |
| Ink | `#1a1712` | Body text |
| Muted | `#8a8578` | Secondary text where contrast remains sufficient |
| Rule | `#e2ddcf` | Dividers and table borders |

Forest and cream carry the identity. Gold is a signal, not a fill for every important element. Status colors must never be the only way a status is communicated.

### Type

| Role | Typeface | Intent |
|---|---|---|
| Display and editorial headings | Playfair Display | Human, established, considered |
| Body and interface | DM Sans | Clear at small sizes and neutral enough for long reading |
| Labels, metadata, and source paths | Geist Mono | Explicit separation between narrative and system evidence |

The documentation may fall back to system fonts when the hosted fonts are unavailable. Content and layout must remain usable without a font request.

### Mark and naming

The company name is **Beacon & Co.** “Beacon” is the short conversational form. Legacy references to “Veslyn” are not part of the current brand and must not appear in public or source-of-truth material.

The logo assets in `public/` and the documented wordmark treatment are canonical. The identity is a beacon in the sense of guidance and visibility; it should not drift into generic lighthouse clip art.

## Voice

Beacon sounds warm, direct, locally aware, and honest about what is known.

Prefer:

- “Here is what is missing and what I would fix first.”
- “Starting at $799.”
- “This is proposed; it is not built yet.”
- “You own the files.”

Avoid:

- guaranteed rankings, revenue, or viral reach;
- inflated automation language;
- urgency invented for conversion;
- unexplained acronyms;
- pretending proposal evidence is current production capability.

## Attention research and the rule it produced

The proposal uses attention research to argue for a clearer page rather than a more stimulating one. Those references are useful only when their limitations remain visible.

| Research signal | What Beacon takes from it | What Beacon does not claim |
|---|---|---|
| Nielsen Norman Group reading studies observed F-shaped scanning in many text-heavy pages | Put the promise and important words early; use meaningful headings and short blocks | Every visitor follows the same path, or the F-pattern should be drawn into the interface |
| A VWO/TechWyse case study reported a “no fees” badge pulling attention away from the CTA | Remove decorative badges and nearby competing actions | One case study proves a universal conversion law |
| Just and Carpenter connected eye fixation with active processing in reading research | Fixation can be evidence of attention and effort | Longer fixation always means persuasion or understanding |
| Gaze-cueing research shows that people can orient toward where a face looks | Directional imagery may support hierarchy | A face looking at a button guarantees a click |

“Eye tracking” and “neuromarketing” are not synonyms. Beacon uses the former as a limited usability input. It does not claim brain-science authority for a design preference.

### Proposal comparison: before

<figure class="architecture-figure">
  <img src="../../assets/architecture/proposal/attention-before.svg" alt="Proposal illustration of a page with attention dispersed among badges, navigation, and competing calls to action">
  <figcaption>Proposal evidence: the “before” attention hypothesis. <a href="../../assets/architecture/proposal/attention-before.svg">Open source SVG</a>.</figcaption>
</figure>

### Proposal comparison: after

<figure class="architecture-figure">
  <img src="../../assets/architecture/proposal/attention-after.svg" alt="Proposal illustration of a page with a clear promise and a single concentrated call to action">
  <figcaption>Proposal evidence: the “after” attention hypothesis. <a href="../../assets/architecture/proposal/attention-after.svg">Open source SVG</a>.</figcaption>
</figure>

## Accepted experience rules

### One clear action per screen

Each viewport should make one next step unmistakable. Navigation may remain available, but a hero should not surround its primary CTA with a secondary button, decorative badge, and unrelated link.

This does not mean a whole page has only one link. It means each major decision point has one primary action.

### Proof follows the promise

Claims should be supported by:

- a concrete deliverable;
- a transparent price or boundary;
- a real example;
- an attributed source;
- an explicit current/proposed status.

### Real people stay real

Use real local photography with permission. Until it exists, use a neutral gray or branded placeholder labeled as such. Do not generate stock photos, owner portraits, customer faces, or testimonial avatars.

### Motion has a job

All motion must:

- explain sequence, show relationship, or confirm an interaction;
- stop being required when `prefers-reduced-motion: reduce` is active;
- leave content available without JavaScript;
- avoid delaying the primary action.

The proposal’s tool choices remain hypotheses:

| Tool | Proposed role | Decision boundary |
|---|---|---|
| CSS and small vanilla scripts | Routine transitions and interface feedback | Accepted for the current static site |
| Motion One | Small coordinated interactions | Add only if CSS becomes materially harder to maintain |
| GSAP | One signature path-drawing or timeline moment | Not installed; justify with measured value |
| Three.js | One lightweight spatial hero treatment | Not installed; must not become a runtime tax |
| Satori | Programmatic branded graphics | Future delivery tooling |
| JSON2Video | Phase-one video assembly | Future and vendor-dependent |
| Remotion | Later in-house video composition | Future; only after recurring volume justifies it |

## Current marketing-site experience

<span class="truth-state truth-state--current">Implemented</span>

The current site is a static Astro experience with:

- a positioning hero;
- local problem and service explanations;
- clear prices and plan boundaries;
- a transparent process;
- evidence and FAQ content;
- a contact form with progressive enhancement;
- reduced-motion support;
- plain CSS and component-scoped vanilla JavaScript.

The implementation source remains the authority for exact current copy and interactions. The original migration reference is `reference/v9-source.html`; content should not be silently rewritten during component work.

## Accessibility baseline

Every public and documentation surface must provide:

- semantic headings and landmarks;
- visible keyboard focus;
- keyboard-operable controls;
- sufficient text and control contrast;
- meaningful alternative text for informative images;
- empty alternative text for purely decorative images;
- form labels and understandable error messages;
- content that remains understandable at zoom;
- reduced-motion behavior.

Passing an automated checker is not equivalent to a usable experience. Keyboard, small-screen, and reduced-motion checks remain part of human verification.

## State and implementation constraints

For the Phase 1 marketing site:

- Astro static output is the default;
- use plain CSS and component-scoped vanilla JavaScript;
- do not add React, Vue, Tailwind, or CSS-in-JS;
- do not use `localStorage` or `sessionStorage`;
- keep transient UI state in memory;
- do not scaffold future application screens or backend services.

Architecture and phase boundaries are defined in [ADR-0003](0003-record-architecture-evolution-and-source-atlas.md).

## Consequences

### Positive

- The business, website, proposal, and handbook tell the same visual and verbal story.
- Design review can be tied to explicit customer and attention rules.
- Accessibility and reduced motion are requirements, not polish.
- Restraint makes local evidence and transparent offers more credible.

### Trade-offs

- A single primary action requires harder content prioritization.
- Real photography takes coordination and may leave placeholders longer.
- Proposed motion tools cannot be added merely because they appeared in the proposal.
- Research references must be periodically rechecked before they are used as public proof.

## Supersedes and sources

This record consolidates the former design-definition and UI-related ADRs removed during the July 2026 decision-book reset.

Primary sources:

- [`docs/brand.md`](../brand.md)
- [`docs/product/experience-specification.md`](../product/experience-specification.md)
- `reference/v9-source.html`
- [Complete business proposal snapshot](../assets/adr-intake/ai-company/beacon-and-co-full-business-proposal.html)
- [ADR-0001 — business definition](0001-why-beacon-exists-and-business-definition.md)
