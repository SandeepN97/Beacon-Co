---
title: 2026-07-26 — Add the AI-company package and business proposal to ADR intake
date: 2026-07-26
type: architecture-and-governance
status: completed
---

# 2026-07-26 — Add the AI-company package and business proposal to ADR intake

## Summary

Imported the supplied AI-company and Claude/Codex broker diagrams plus the complete interactive business proposal into a governed ADR intake area. The package is preserved as portable project evidence while its business claims, roles, review gates, token/cost implications, and later-phase broker architecture remain under review.

## Changed

- `docs/decisions/intake/` — intake register, AI-company assessment, and reusable intake template.
- `docs/assets/adr-intake/ai-company/` — canonical Excalidraw canvas, 16-item library, contact sheet, opening instructions, and the full renamed interactive business proposal.
- `docs/business/plan.md` — links the proposal evidence and records the reconciliation requirement.
- `docs/decisions/index.md` and `mkdocs.yml` — visible ADR intake navigation.
- `docs/governance/documentation-policy.md` — separates intake evidence from accepted ADRs.

## Import integrity

- The standalone submitted canvas and the package canvas had the same SHA-256 checksum.
- One canonical canvas was stored to avoid duplication.
- The intake record preserves SHA-256 checksums for all four imported artifacts.
- The canvas contains 840 elements and no embedded files.
- The library contains 16 published items: one combined overview, one all-agent board, and 14 individual role diagrams.
- The original proposal checksum is recorded, all 29 previous-name variants were renamed, and no previous-name reference remains in the canonical proposal.
- The complete proposal keeps every section, table, SVG, Mermaid source, prospect record, interactive model, and script.
- The proposal now uses the pinned local Mermaid `11.16.0` bundle instead of a remote Mermaid `10.9.0` CDN script.

## Decisions

No new accepted decision. The package is under review and has been decomposed into candidate ADR topics. ADR-0017 remains available for the next accepted decision.

## Implementation impact

Documentation intake only. No broker, queue, scheduler, model registry, persistent agent service, backend, or later-phase infrastructure was implemented.

## Validation

- JSON parsing of the `.excalidraw` and `.excalidrawlib` files — passed.
- Source-to-import SHA-256 comparison — passed.
- Contact sheet visual inspection — passed.
- Proposal section/table/SVG/script inventory and rename scan — passed.
- Headless Chrome renders of the branded intake page and complete renamed proposal — passed.
- `npm run docs:build` — passed in strict mode.
- `npm run build` — passed; one static application page generated.
- Live intake, proposal, canvas, library, contact-sheet, and instruction routes — HTTP 200.
- `git diff --check` — passed.

## Follow-up

- Compare a minimal, risk-scaled Claude/Codex switching workflow with the existing file-based AI Agent Workflow before proposing an implementation ADR.
