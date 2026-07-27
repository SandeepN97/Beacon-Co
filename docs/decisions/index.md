---
title: Beacon Decision Book
date: 2026-07-26
---

# Beacon Decision Book

This is the project source of truth. It starts with **why Beacon & Co. exists**, then records the business, experience, architecture, and operating model in dependency order.

<div class="truth-banner">
  <strong>Fresh baseline · 2026-07-26</strong>
  <span>The prior 16-record ADR set and intake hierarchy were removed. Four complete, evidence-linked records replace them.</span>
</div>

## Read in this order

<div class="decision-grid">
  <a class="decision-card" href="0001-why-beacon-exists-and-business-definition/">
    <span class="decision-card__number">ADR-0001</span>
    <h3>Why Beacon exists</h3>
    <p>The local observation, market evidence, prospects, competitors, offer, economics, roadmap, risks, and founding business decision.</p>
  </a>
  <a class="decision-card" href="0002-define-brand-and-customer-experience/">
    <span class="decision-card__number">ADR-0002</span>
    <h3>Brand and customer experience</h3>
    <p>The visual system, voice, research, CTA hierarchy, page behavior, photography, accessibility, and motion rules.</p>
  </a>
  <a class="decision-card" href="0003-record-architecture-evolution-and-source-atlas/">
    <span class="decision-card__number">ADR-0003</span>
    <h3>Architecture evolution and source atlas</h3>
    <p>What exists, how the system evolved, what remains proposed, and every maintained Mermaid, SVG, and Excalidraw source.</p>
  </a>
  <a class="decision-card" href="0004-use-a-durable-ai-assisted-operating-model/">
    <span class="decision-card__number">ADR-0004</span>
    <h3>Durable AI-assisted operating model</h3>
    <p>Claude/Codex switching, compact handoffs, token discipline, review gates, documentation ownership, and proposed role architecture.</p>
  </a>
</div>

## Proposal coverage

The complete renamed proposal remains an immutable evidence snapshot. Its information is now organized into the decision book instead of sitting in a separate intake queue.

| Proposal section | Authoritative decision-book destination | Treatment |
|---|---|---|
| Market | [ADR-0001](0001-why-beacon-exists-and-business-definition.md#local-evidence-that-triggered-the-business) | Claims, estimates, caveats, and local gap evidence |
| Validated pipeline | [ADR-0001](0001-why-beacon-exists-and-business-definition.md#named-prospect-evidence) | Four anchors and all 33 exposed tier rows |
| Competitor intelligence | [ADR-0001](0001-why-beacon-exists-and-business-definition.md#competitor-evidence) | Seven dossiers, comparison, and three market gaps |
| Services | [ADR-0001](0001-why-beacon-exists-and-business-definition.md#the-offer) | Product sequence, prices, delivery assumptions |
| Business machine | [ADR-0003](0003-record-architecture-evolution-and-source-atlas.md#proposal-architecture-eight-original-visual-sources) | Business loop, platform sketch, and lead sequence |
| Technology stack | [ADR-0003](0003-record-architecture-evolution-and-source-atlas.md#proposed-nine-layer-target) | Nine layers, vendor hypotheses, Mermaid and SVG sources |
| Content automation | [ADR-0003](0003-record-architecture-evolution-and-source-atlas.md#content-media-and-publishing-proposal) | Media, publishing, approval, and motion pipelines |
| Attention design | [ADR-0002](0002-define-brand-and-customer-experience.md#attention-research-and-the-rule-it-produced) | Research limits and accepted interface rules |
| Agentic build | [ADR-0004](0004-use-a-durable-ai-assisted-operating-model.md) | Switching, review, stages, roles, and phase guardrail |
| Financial model | [ADR-0001](0001-why-beacon-exists-and-business-definition.md#financial-model) | Inputs, formula, scenarios, capacity, and caveats |
| Economics | [ADR-0001](0001-why-beacon-exists-and-business-definition.md#cost-structure) | Startup, fixed, variable, time, and margin assumptions |
| Retention | [ADR-0001](0001-why-beacon-exists-and-business-definition.md#retention-model) | Proof loop, churn target, ownership, and prepay |
| Roadmap | [ADR-0001](0001-why-beacon-exists-and-business-definition.md#business-roadmap) and [ADR-0003](0003-record-architecture-evolution-and-source-atlas.md#phase-boundaries) | Business gates separated from technical status |
| Risks and action | [ADR-0001](0001-why-beacon-exists-and-business-definition.md#risks-and-truth-boundaries) | Risks, mitigations, and first-client priority |

## Truth labels

<div class="truth-key">
  <span class="truth-state truth-state--current">Implemented</span>
  <span>Verified in the repository or deployment.</span>
  <span class="truth-state truth-state--accepted">Accepted</span>
  <span>A governing requirement or decision.</span>
  <span class="truth-state truth-state--proposed">Proposed</span>
  <span>A future direction that must be revalidated before implementation.</span>
  <span class="truth-state truth-state--evidence">Evidence</span>
  <span>A preserved claim, observation, or source—not automatically accepted as fact.</span>
</div>

## Complete evidence snapshot

[Open the complete interactive proposal](../assets/adr-intake/ai-company/beacon-and-co-full-business-proposal.html). It remains available because it contains interactive prospect, technology, financial, diagram, and roadmap data that should not be lost when the decision structure changes.

The build runs `npm run docs:validate` to ensure the proposal, its extracted sources, and the maintained architecture assets stay complete.
