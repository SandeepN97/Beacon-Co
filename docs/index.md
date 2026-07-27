---
title: Beacon & Co. Source of Truth
---

# One local observation became a business—and then a system.

<div class="decision-lede decision-lede--hero">
  <span class="decision-card__number">BEACON & CO. · WAYNESBORO, VIRGINIA</span>
  <p>Good local businesses were difficult to find online. Beacon started by asking whether one clear, useful website could close that gap. The answer evolved into a transparent service business, a phase-gated architecture, and a durable way to build it.</p>
  <a class="beacon-action" href="decisions/0001-why-beacon-exists-and-business-definition/">Begin with why Beacon exists</a>
</div>

## This is the project memory

The Decision Book is the source of truth for what Beacon is, why it exists, how it should feel, what architecture runs today, what remains proposed, and how work continues between Claude Code and Codex.

<div class="truth-banner">
  <strong>Fresh decision baseline · July 26, 2026</strong>
  <span>Four complete records replace the previous 16-ADR and intake hierarchy. The proposal and all supplied diagram evidence are preserved.</span>
</div>

## Read the decisions in order

<div class="decision-grid">
  <a class="decision-card" href="decisions/0001-why-beacon-exists-and-business-definition/">
    <span class="decision-card__number">01 · FOUNDING</span>
    <h3>Why Beacon exists</h3>
    <p>The local gap, named evidence, competitors, customer, offer, economics, roadmap, and business risks.</p>
  </a>
  <a class="decision-card" href="decisions/0002-define-brand-and-customer-experience/">
    <span class="decision-card__number">02 · EXPERIENCE</span>
    <h3>How Beacon earns trust</h3>
    <p>The brand, voice, attention rules, photography boundary, accessibility, interactions, and motion.</p>
  </a>
  <a class="decision-card" href="decisions/0003-record-architecture-evolution-and-source-atlas/">
    <span class="decision-card__number">03 · ARCHITECTURE</span>
    <h3>How one site can evolve safely</h3>
    <p>The current system, phase gates, proposed platform, and every Mermaid, SVG, and Excalidraw source.</p>
  </a>
  <a class="decision-card" href="decisions/0004-use-a-durable-ai-assisted-operating-model/">
    <span class="decision-card__number">04 · OPERATIONS</span>
    <h3>How the work keeps moving</h3>
    <p>The compact handoff between Claude and Codex, token discipline, review stages, and human authority.</p>
  </a>
</div>

## From observation to architecture

<div class="evolution-line">
  <div><span>01</span><strong>Observe</strong><p>Strong nearby businesses have incomplete online presence.</p></div>
  <div><span>02</span><strong>Test</strong><p>Build one useful, transparent marketing experience.</p></div>
  <div><span>03</span><strong>Productize</strong><p>Turn recurring needs into a clear offer and delivery loop.</p></div>
  <div><span>04</span><strong>Gate</strong><p>Add architecture only when a proven workflow requires it.</p></div>
</div>

## What is true now

| Area | Status | Source |
|---|---|---|
| Business definition and offer | <span class="truth-state truth-state--accepted">Accepted</span> | [ADR-0001](decisions/0001-why-beacon-exists-and-business-definition.md) |
| Brand and customer experience | <span class="truth-state truth-state--accepted">Accepted</span> | [ADR-0002](decisions/0002-define-brand-and-customer-experience.md) |
| Astro marketing site and narrow contact route | <span class="truth-state truth-state--current">Implemented</span> | [Current Truth](current-state.md) |
| Data platform, queues, admin, content workers, and publishing | <span class="truth-state truth-state--proposed">Proposed</span> | [ADR-0003](decisions/0003-record-architecture-evolution-and-source-atlas.md) |
| Proposal research, claims, and vendor assumptions | <span class="truth-state truth-state--evidence">Evidence</span> | [Complete proposal snapshot](assets/adr-intake/ai-company/beacon-and-co-full-business-proposal.html) |

## Truth has four labels

<div class="truth-key">
  <span class="truth-state truth-state--current">Implemented</span>
  <span>Verified in code, configuration, a build, or deployment.</span>
  <span class="truth-state truth-state--accepted">Accepted</span>
  <span>A governing business, experience, architecture, or operating decision.</span>
  <span class="truth-state truth-state--proposed">Proposed</span>
  <span>A future direction that must be revalidated before it becomes current.</span>
  <span class="truth-state truth-state--evidence">Evidence</span>
  <span>A preserved observation, claim, source, or hypothesis.</span>
</div>

## Conflict rule

When the handbook and repository disagree, do not quietly choose one:

1. executable code and a passing build provide evidence of what runs;
2. accepted decisions explain what governs and why;
3. [Current Truth](current-state.md) must summarize the implemented boundary;
4. proposals remain evidence until explicitly adopted;
5. chat history is never project memory.

Reconcile a material conflict in the same change that exposes it.

