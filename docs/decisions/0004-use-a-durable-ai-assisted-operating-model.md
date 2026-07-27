---
title: ADR-0004 — Use a durable AI-assisted operating model
date: 2026-07-26
status: accepted
decision-type: operations
---

# ADR-0004 — Use a durable AI-assisted operating model

<div class="decision-lede">
  <span class="decision-card__number">OPERATING DECISION · ACCEPTED</span>
  <p>Claude Code and Codex are interchangeable collaborators, not the memory of the project. Repository files carry context so work can continue when a model reaches a usage cap, a session ends, or another agent is better suited to the next bounded task.</p>
</div>

## Decision

Use a small, file-based continuity system now:

- this MkDocs handbook holds business and architecture truth;
- `AGENTS.md` holds repository working constraints;
- `.ai/handoff.md` holds the shortest current cross-agent checkpoint;
- `docs/ai-agent-workflow.md` explains the repeatable workflow;
- Git history and change records show what changed;
- deterministic builds decide whether an implementation is valid.

Do **not** build an agent broker, model registry, queue, memory database, or multi-agent backend during Phase 1. The elaborate agent system in the proposal is preserved as a future operating hypothesis.

## The problem this solves

Claude Code can reach a temporary cap. Codex sessions can also end or lose conversational detail. If the useful context exists only in chat, switching tools causes:

- repeated repository discovery;
- repeated explanation of settled decisions;
- prompts filled with obsolete details;
- contradictory architecture assumptions;
- extra token use without advancing the project.

The project should survive either model disappearing for several hours.

## The continuity contract

Before a planned switch—or after any material work session—the active collaborator updates `.ai/handoff.md` with only:

```text
Objective:
Current state:
Decisions already settled:
Constraints:
Files changed:
Verification run:
Open risks:
Exact next action:
```

The handoff is not a transcript. It is a checkpoint pointing to durable sources.

On resume, the next collaborator reads in this order:

1. `AGENTS.md`;
2. `.ai/handoff.md`;
3. the decision record named by the handoff;
4. `docs/current-state.md`;
5. only the implementation files needed for the next action.

That order reduces broad repository reads while preserving the constraints that matter.

## Shape a rough thought before prompting

When the founder starts with an unfinished idea, convert it into a compact task brief:

| Field | Question |
|---|---|
| Outcome | What should be true when the task is finished? |
| Current state | What exists now, and where? |
| Constraints | What must not change? |
| Evidence | Which decision, source file, or proposal section controls the work? |
| Acceptance | What observable checks prove completion? |
| Scope | Which files or surfaces are in bounds? |
| Next action | What is the smallest useful step? |

Example:

```text
Outcome: Make the documentation sidebar readable and make all architecture sources reachable.
Current state: MkDocs site exists; proposal contains embedded SVG and Mermaid sources.
Constraints: Beacon brand, no backend, preserve original proposal evidence.
Acceptance: strict docs build passes; every diagram route returns; desktop/mobile/reduced-motion pages are visually checked.
Scope: mkdocs.yml, docs styles, decision book, diagram extraction.
Next action: inventory the proposal diagram sources before changing navigation.
```

## Token-use rules

Tokens are saved by reducing uncertainty, not by asking for shorter answers at every step.

- Point to source files instead of pasting their contents.
- Read the narrowest controlling document first.
- Record decisions once; link to them elsewhere.
- Keep handoffs factual and under one screen when possible.
- Separate “current” from “proposed” so agents do not investigate nonexistent services.
- Ask for one bounded outcome per implementation turn.
- Use repository search before rereading whole directories.
- Run deterministic checks instead of asking a second model to speculate about correctness.
- Use another model for material judgment or review, not as a ritual duplicate of every step.
- Delete stale handoff details when the task moves on.

## Switching between Claude Code and Codex

```mermaid
--8<-- "diagrams/proposal/provider-failover.mmd"
```

The proposal’s provider-failover diagram is adopted as a human-controlled continuity pattern, not as an autonomous router.

### Switch procedure

1. Finish or stop at a safe file boundary.
2. Run the relevant build or record exactly why it could not run.
3. Update `.ai/handoff.md`.
4. Start the other tool in the repository root.
5. Ask it to read the continuity contract before acting.
6. Give it the exact next outcome, not the previous transcript.
7. Let the build, decision book, and diff resolve disagreements.

If Claude is capped, use Codex. If Codex is unavailable or Claude is better suited to the current review, use Claude. No model owns the project.

## Twelve-stage proposed workflow

```mermaid
--8<-- "diagrams/proposal/twelve-stage-agent-workflow.mmd"
```

The proposal expands delivery into 12 stages:

1. intake and objective definition;
2. context and source retrieval;
3. constraints and policy check;
4. planning;
5. research;
6. production;
7. structured validation;
8. critical review;
9. repair;
10. human approval;
11. release;
12. measurement and learning.

For the current project these are review lenses, not twelve always-running processes. A copy edit may use only intake, production, validation, and release. A change to contact security may require every applicable stage.

## Proposed specialist roles

The supplied canvas describes a broad AI-company organization. Preserve these as **risk-scaled roles**, not persistent services:

| Role | Bounded responsibility |
|---|---|
| Intake | Turn the request into an executable brief |
| Planner | Sequence dependencies and verification |
| Research | Gather current, attributed evidence |
| Business | Check offer, market, and economics |
| Brand | Protect voice and visual rules |
| Experience | Check hierarchy, accessibility, and interaction |
| Architecture | Protect boundaries and phase gates |
| Implementation | Change the smallest necessary code surface |
| Content | Draft source-grounded copy and assets |
| Security | Threat-model data, secrets, abuse, and access |
| Compliance | Check outreach, consent, platform, and claim risk |
| Quality | Run builds, tests, links, and visual review |
| Finance | Track vendor and delivery cost assumptions |
| Release | Confirm approval, change record, and rollback evidence |

One person or one model can perform several roles. A role becomes a separate worker only when repeated volume, permissions, and failure handling justify it.

## Human authority

Automation may prepare:

- a brief;
- research;
- a draft;
- a code change;
- a test result;
- a content package;
- a recommendation.

The founder retains authority over sales, pricing exceptions, release, credentials, external messaging, and business commitments. The client retains approval before drafted client content is published.

## Truth and conflict resolution

When sources disagree:

1. implemented code and a passing build control claims about what runs;
2. an accepted decision controls why and where the system should go;
3. `docs/current-state.md` summarizes the implemented boundary;
4. a proposal is evidence until adopted;
5. a handoff controls only the immediate next action;
6. chat history is never the source of truth.

If code intentionally changes an accepted decision, update the decision and change record in the same work unit.

## Source package

The complete exploratory material remains available:

- [840-element combined Excalidraw canvas](../assets/adr-intake/ai-company/ai_company_all_agents_and_combined_canvas.excalidraw)
- [16-item Excalidraw library](../assets/adr-intake/ai-company/ai_company_all_agents_and_combined.excalidrawlib)
- [AI-agent contact sheet](../assets/adr-intake/ai-company/ai_company_all_agents_contact_sheet.png)
- [Complete business proposal snapshot](../assets/adr-intake/ai-company/beacon-and-co-full-business-proposal.html)

These sources inform the operating model. They do not authorize speculative Phase 1 infrastructure.

## Consequences

### Positive

- Work can move between Claude Code and Codex without relying on a long transcript.
- Prompts become shorter because decisions and current state have stable addresses.
- The project can add specialist review without pretending it has an agent platform.
- Builds and source-controlled evidence settle more disputes than model opinion.

### Trade-offs

- The active collaborator must maintain the handoff.
- A stale checkpoint can mislead the next session, so it must remain compact and dated.
- Some proposal automation is deliberately deferred.
- The founder remains the bottleneck for consequential approval, by design.

## Supersedes and sources

This record consolidates the former AI-agent intake and AI-governance decisions removed during the July 2026 decision-book reset.

Primary sources:

- [`docs/ai-agent-workflow.md`](../ai-agent-workflow.md)
- `.ai/handoff.md`
- `AGENTS.md`
- [ADR-0003 — architecture evolution and source atlas](0003-record-architecture-evolution-and-source-atlas.md)
- [Complete business proposal snapshot](../assets/adr-intake/ai-company/beacon-and-co-full-business-proposal.html)
