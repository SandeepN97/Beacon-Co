---
title: 2026-07-26 — Organize decision foundations and add the architecture proposal
date: 2026-07-26
type: architecture-and-documentation
status: completed
---

# 2026-07-26 — Organize decision foundations and add the architecture proposal

## Summary

Reorganized the initial ADR baseline so the decision register begins with the business definition, design definition, and phased architecture proposal. Grouped all dependent decisions by business offer, public experience, platform foundations, operations/automation, and cross-cutting controls.

## Problem and expected outcome

The original ADR IDs reflected the order the files were drafted rather than the order decisions depend on one another. A reader encountered framework and deployment choices before learning what business, experience, and system those choices were meant to support.

The register now answers questions in this order:

```text
Why does the business exist?
    → What experience represents it?
    → What system direction supports it?
    → Which offer and implementation choices follow?
```

## Changed

- `docs/decisions/0001-*.md` through `0015-*.md` — corrected and expanded the initial ADR sequence.
- `docs/decisions/index.md` — groups decisions by responsibility and records the dependency order.
- `docs/proposals/architecture-proposal.md` — defines goals, non-goals, system context, phases, component boundaries, flows, controls, acceptance criteria, and open validation questions.
- `mkdocs.yml` — adds the proposal and replaces the flat ADR list with grouped navigation.
- `docs/index.md` — distinguishes proposals from ADRs, current state, roadmap, and change records.
- `docs/architecture.md` — links the proposal and corrected component ADRs.
- `docs/current-state.md` — records the accepted proposal and decision order.
- `AGENTS.md` — requires agents to read the proposal and foundational ADRs before dependent structural decisions.
- `README.md` — adds the architecture proposal to the repository map and phase guidance.
- Business, product, and prior change records — corrected to the new canonical ADR links.

## Renumbering note

This correction applies to the initial documentation baseline before the ADR set has been committed as stable project history. After this baseline, accepted ADR IDs are immutable: future decisions use the next number and supersede earlier records instead of renumbering them.

## Decisions

- [Current ADR-0001 — Why Beacon exists and the business definition](../decisions/0001-why-beacon-exists-and-business-definition.md)
- [Current ADR-0002 — Brand and customer experience](../decisions/0002-define-brand-and-customer-experience.md)
- [Current ADR-0003 — Architecture evolution and source atlas](../decisions/0003-record-architecture-evolution-and-source-atlas.md)

## Implementation impact

Documentation structure only. No application behavior, deployment configuration, backend infrastructure, database, queue, or future-phase code was added.

## Validation

- `npm run docs:build` — passed in strict mode.
- ADR filename, frontmatter ID, and heading ID consistency — passed for all 15 records.
- Legacy initial ADR filenames and links — none remain.
- Decision register, ADR-0001, ADR-0002, ADR-0003, and Architecture Proposal routes — HTTP 200 after restarting the local documentation server.
- `npm run build` — passed; one static application page generated.
- `git diff --check` — passed.

## Follow-up

- This earlier numbering guidance was superseded by the [Decision Book reset](2026-07-26-reset-decision-book-and-architecture-sources.md).
- Keep the proposal directional, Current State factual, and component ADRs focused on one decision each.
- Supersede accepted ADRs rather than reorganizing their IDs in the future.
