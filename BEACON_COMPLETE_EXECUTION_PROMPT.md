# BEACON COMPLETE EXECUTION PROMPT

## Instruction to Codex

Read this file completely before taking action.

Execute the project from beginning to end inside the current `Beacon-Co` Visual Studio Code workspace.

Do not ask the user to restate the architecture described in this file.

Start with repository and source inspection, create the required build plan, then continue through implementation, documentation, tests, and the final implementation report.

Do not deploy, merge, push, delete source files, or modify files outside the repository.

---


You are working inside the existing `Beacon-Co` repository in Visual Studio Code.

## Mission

Turn all project source materials, architecture diagrams, business plans, agent definitions, broker rules, and future plans into one complete, production-quality, docs-as-code website using **Astro + Markdoc**.

This is not a quick summary and not a single giant Markdown page. Build a maintainable documentation system that becomes the canonical source of truth for the Beacon multi-agent business.


## Core operating experience: Claude-first, Markdoc-grounded, broker-routed

The system must be designed around the following user experience:

```text
User explains an idea in ordinary language
        ↓
Intent and Prompt Translator
        ↓
Structured Work Request
        ↓
Markdoc Knowledge Retrieval
        ↓
Broker routing decision
        ↓
Claude or Codex performs the assigned role
        ↓
Independent review and deterministic checks
        ↓
Human approval when required
        ↓
Result plus proposed Markdoc updates
```

The user is not expected to be an expert prompt engineer.

The system must accept incomplete, informal, conversational, misspelled, or loosely structured requests and convert them into safe, testable, traceable work units.

### Required default behavior

1. **Claude is the preferred first provider** for normal business analysis, planning, architecture, documentation, product thinking, and general orchestration when Claude is healthy and has adequate capacity.
2. **Codex is selected when:**
   - the task has a stronger repository implementation, debugging, testing, refactoring, or code-review affinity
   - Claude is rate-limited, unavailable, cooling down, or close to an operator-defined capacity limit
   - Codex has better current repository context
   - an independent second voice is required
   - the user explicitly requests Codex
   - measured historical evidence shows Codex is better for that category of work
3. Claude-first is a routing preference, not a permanent role assignment.
4. Roles remain stable and provider-independent.
5. The exact provider and session that authored a deliverable cannot independently approve it.
6. When the preferred provider cannot continue, the broker must preserve the work unit, approved context, decisions, evidence, and current state before handing the task to the fallback provider.
7. Provider fallback must not require the user to rewrite the request.

### Source-of-truth rule

The published Astro + Markdoc documentation is the canonical business and architecture source of truth.

Before any substantial work begins, the system must retrieve and package the relevant approved documentation, including:

- product vision
- business rules
- terminology
- approved requirements
- architecture pages
- accepted ADRs
- agent contracts
- workflow rules
- permissions and human gates
- current roadmap phase
- repository conventions
- known risks and open questions

Claude and Codex must not rely only on chat history when durable project documentation exists.

If chat instructions conflict with approved Markdoc content:

1. identify the conflict
2. show the current documented rule
3. determine whether the user is requesting a temporary exception or a permanent change
4. require the appropriate approval
5. create or update an ADR when the architecture or governance rule changes
6. update Markdoc only through a reviewable change

No agent may silently overwrite the source of truth.

### Documentation write-back rule

Every completed work unit must determine whether the canonical documentation changed.

The completion report must include:

```text
Documentation impact:
- none
- update existing page
- create new page
- create or supersede ADR
- update roadmap
- update runbook
- update agent contract
```

When documentation impact is not `none`, the work unit is not complete until the proposed documentation changes are included in the reviewable branch or explicitly deferred with an owner and reason.


## Critical terminology

Use **Markdoc**, not “Markfile.”

- Markdoc content files use the `.mdoc` extension.
- Use Astro content collections for documentation content.
- Use reusable Astro components through Markdoc tags where appropriate.


## Source files are currently in the Mac Downloads folder

All supplied project materials are currently stored in the signed-in user's macOS Downloads directory:

```text
~/Downloads
```

Resolve this location dynamically with:

```bash
DOWNLOADS_DIR="$HOME/Downloads"
```

Do not hard-code a username such as `/Users/name/Downloads`.

Before inspecting or modifying the Beacon documentation implementation:

1. Confirm the current repository root with:

   ```bash
   pwd
   git rev-parse --show-toplevel 2>/dev/null || true
   ```

2. Confirm that the Downloads directory is readable:

   ```bash
   test -d "$HOME/Downloads" && echo "Downloads found"
   ```

3. Search only the top level of `~/Downloads` first for the supplied source files. Match filename variations such as spaces, `(1)`, copied versions, and similar suffixes.

4. Create this repository-local source area:

   ```text
   reference/
   └── source-materials/
       ├── originals/
       ├── extracted/
       ├── generated-previews/
       └── inventory/
   ```

5. **Copy** relevant source files from `~/Downloads` into:

   ```text
   reference/source-materials/originals/
   ```

6. Never move, rename, modify, or delete the original files in `~/Downloads`.

7. Preserve original filenames. When a destination filename already exists:

   - compare file hashes
   - do not create another copy when the files are identical
   - when contents differ, preserve both using a collision-safe suffix
   - record the relationship in the source inventory

8. Record for every copied source:

   - original Downloads path
   - repository copy path
   - filename
   - extension
   - byte size
   - modification time
   - SHA-256 hash
   - authority tier
   - extraction status
   - notes about duplicates or conflicts

9. Save the machine-readable inventory as:

   ```text
   reference/source-materials/inventory/source-inventory.json
   ```

10. Save a readable inventory summary as:

   ```text
   reference/source-materials/inventory/source-inventory.md
   ```

11. Perform all extraction and conversion work on repository-local copies. Never extract archives directly over the original Downloads files.

12. If macOS permissions prevent access to `~/Downloads`, stop only the source-import portion, document the exact failed command and error in `docs-build-plan.md`, and continue with repository files that are already available. Do not claim that missing files were inspected.

### Expected Downloads filename patterns

Search for these patterns and close filename variants:

```text
Claude_Multi_Agent_Business_Guide*.pdf
Claude_Codex_Broker_Addendum*.docx
ai_company_all_agents_and_combined_canvas*.excalidraw
ai_company_all_agents_one_file_package*.zip
easy_read_ai_company_architecture*.excalidraw
individual_agent_architecture_animated*.excalidraw
multi_agent_business_broker_excalidraw_package*.zip
unified_agent_operating_architecture_all_in_one*.excalidraw
smart-home-architecture*.html
v9-source*.html
veslyn-proposal*.html
```

Use a null-delimited search so filenames containing spaces and parentheses are handled safely. A suitable starting approach is:

```bash
find "$HOME/Downloads" -maxdepth 1 -type f -print0
```

Filter the results carefully. Do not copy unrelated files from Downloads.

### Safe import behavior

Implement the import with a small repository-local script when useful, for example:

```text
scripts/import-reference-materials.mjs
```

The script must be:

- idempotent
- safe with spaces and parentheses in filenames
- hash-aware
- non-destructive
- limited to `~/Downloads` and the repository's `reference/source-materials/` directory
- capable of producing both JSON and Markdown inventories

Do not add absolute user-specific paths to committed documentation. Store the original location in inventory as `~/Downloads/<filename>` where practical, rather than exposing the full local username path.

## First rule: inspect before editing

Before changing files:

1. Discover and safely copy the relevant source materials from `~/Downloads` into `reference/source-materials/originals/` using the rules above.
2. Generate the JSON and Markdown source inventories.
3. Read the repository root and inspect:
   - `package.json`
   - `astro.config.*`
   - `src/`
   - `public/`
   - `README.md`
   - `AGENTS.md`
   - `CLAUDE.md`
   - `KICKOFF_PROMPT.md`
   - `SETUP.md`
   - existing documentation and configuration files
4. Recursively inspect the `reference/` directory and all supplied source materials.
5. Create `docs-build-plan.md` containing:
   - current repository assessment
   - source inventory
   - source authority classification
   - proposed information architecture
   - files to add or modify
   - risks and unresolved questions
   - implementation sequence
6. Then continue implementation without waiting, unless there is a true blocker that would risk destroying existing work.

Do not delete, overwrite, or redesign unrelated working application features.

## Source authority

Classify the supplied files before using them.

### Tier 1 — authoritative project content

These define the Beacon organization, agents, workflow, and broker architecture:

- `Claude_Multi_Agent_Business_Guide*.pdf`
- `Claude_Codex_Broker_Addendum*.docx`
- `ai_company_all_agents_and_combined_canvas*.excalidraw`
- `easy_read_ai_company_architecture*.excalidraw`
- `individual_agent_architecture_animated*.excalidraw`
- `unified_agent_operating_architecture_all_in_one*.excalidraw`
- `ai_company_all_agents_one_file_package*.zip`
- `multi_agent_business_broker_excalidraw_package*.zip`

### Tier 2 — authoritative repository context

These define the current implementation and project constraints:

- existing source code
- `README.md`
- `AGENTS.md`
- `CLAUDE.md`
- `KICKOFF_PROMPT.md`
- `SETUP.md`
- current package and Astro configuration
- existing docs, tests, scripts, and deployment configuration

When Tier 1 conceptual documents conflict with the actual repository, document the difference clearly:

- `Current implementation`
- `Target architecture`
- `Migration required`
- `Decision needed`

Do not silently pretend the target design is already implemented.

### Tier 3 — visual and interaction references only

Use these for layout, interaction ideas, responsive behavior, cards, tabs, navigation, diagram presentation, and visual polish:

- `v9-source*.html`
- `veslyn-proposal*.html`
- `smart-home-architecture*.html`

Do **not** copy their unrelated smart-home, local-business, customer, financial, or Veslyn domain content into Beacon documentation.

## Binary and archive inspection

Inspect all useful files rather than relying only on filenames.

- For `.docx`, extract and read its XML or use an available document converter.
- For `.pdf`, use available local PDF text extraction tools.
- For `.zip`, list and inspect all contained files. Do not mutate the original archive.
- For `.excalidraw`, parse the JSON and extract:
  - titles
  - labels
  - agent names
  - workflow stages
  - component relationships
  - embedded animation order metadata
- For `.html`, inspect headings, components, navigation, responsive patterns, scripts, and CSS.

If a local extraction tool is unavailable, use a safe repository-local script. Do not invent missing content.



## Required project structure: separate orchestration module inside Beacon-Co

Implement the translator, broker, provider routing, approvals, audit, workflows, and documentation-impact logic as a separate internal module inside the existing `Beacon-Co` repository.

Do not create a separate repository at this stage.

Do not place core orchestration rules directly inside Astro page components.

Use this target boundary:

```text
Beacon-Co/
├── src/
│   ├── content/
│   │   └── docs/
│   │       └── ... Markdoc source-of-truth content
│   │
│   ├── modules/
│   │   └── orchestration/
│   │       ├── domain/
│   │       │   ├── work-request.ts
│   │       │   ├── work-unit.ts
│   │       │   ├── provider.ts
│   │       │   ├── approval.ts
│   │       │   ├── evidence.ts
│   │       │   └── documentation-impact.ts
│   │       │
│   │       ├── translator/
│   │       │   ├── intent-translator.ts
│   │       │   ├── clarification-policy.ts
│   │       │   ├── assumption-builder.ts
│   │       │   ├── acceptance-criteria-builder.ts
│   │       │   └── translator-schema.ts
│   │       │
│   │       ├── knowledge/
│   │       │   ├── markdoc-reader.ts
│   │       │   ├── document-index.ts
│   │       │   ├── context-retriever.ts
│   │       │   ├── conflict-detector.ts
│   │       │   └── context-packager.ts
│   │       │
│   │       ├── broker/
│   │       │   ├── broker.ts
│   │       │   ├── router.ts
│   │       │   ├── routing-policy.ts
│   │       │   ├── capacity-manager.ts
│   │       │   ├── provider-health.ts
│   │       │   └── continuation-manager.ts
│   │       │
│   │       ├── providers/
│   │       │   ├── provider-adapter.ts
│   │       │   ├── claude/
│   │       │   │   ├── claude-adapter.ts
│   │       │   │   └── claude-prompt-compiler.ts
│   │       │   └── codex/
│   │       │       ├── codex-adapter.ts
│   │       │       └── codex-prompt-compiler.ts
│   │       │
│   │       ├── workflows/
│   │       │   ├── workflow-engine.ts
│   │       │   ├── workflow-registry.ts
│   │       │   ├── quality-gates.ts
│   │       │   ├── repair-loop.ts
│   │       │   └── completion-policy.ts
│   │       │
│   │       ├── approvals/
│   │       │   ├── approval-manager.ts
│   │       │   ├── approval-policy.ts
│   │       │   └── approval-store.ts
│   │       │
│   │       ├── audit/
│   │       │   ├── audit-service.ts
│   │       │   ├── event-types.ts
│   │       │   └── evidence-store.ts
│   │       │
│   │       ├── documentation/
│   │       │   ├── impact-analyzer.ts
│   │       │   ├── update-proposal.ts
│   │       │   └── adr-proposal.ts
│   │       │
│   │       └── index.ts
│   │
│   ├── components/
│   │   ├── docs/
│   │   └── orchestration/
│   │       ├── RequestInput.astro
│   │       ├── IntentPreview.astro
│   │       ├── AssumptionReview.astro
│   │       ├── ProviderDecision.astro
│   │       ├── ApprovalGate.astro
│   │       └── WorkUnitStatus.astro
│   │
│   └── pages/
│       ├── docs/
│       └── workspace/
│           ├── index.astro
│           ├── requests/
│           ├── approvals/
│           └── runs/
│
├── tests/
│   └── orchestration/
│       ├── translator.test.ts
│       ├── knowledge-retrieval.test.ts
│       ├── routing.test.ts
│       ├── fallback.test.ts
│       ├── continuation.test.ts
│       └── documentation-impact.test.ts
│
└── reference/
```

Adapt filenames only when the current repository structure or framework conventions require it.

### Module responsibilities

```text
translator/
Understands the user's ordinary-language request and creates a provider-neutral work request.

knowledge/
Retrieves approved Markdoc pages, ADRs, policies, plans, and repository guidance.

broker/
Chooses workflow, provider, sequencing, retries, fallback, and completion state.

providers/
Compiles and sends provider-specific prompts while preserving the same approved work meaning.

workflows/
Enforces stage transitions, deterministic gates, independent review, and bounded repair.

approvals/
Pauses high-impact actions until an authorized human decides.

audit/
Stores execution decisions, evidence, failures, provider changes, approvals, and outcomes.

documentation/
Determines whether Markdoc, ADRs, roadmaps, runbooks, or agent contracts must be updated.
```

### Hard module boundaries

1. Astro pages may call the orchestration module, but must not contain routing policy.
2. The translator must not directly call Claude or Codex.
3. The knowledge retriever must not decide provider routing.
4. Provider adapters must not alter acceptance criteria or business meaning.
5. Workers must not mark work units complete.
6. Markdoc must not be used as a runtime transaction database.
7. Runtime state must not silently rewrite approved Markdoc content.
8. All documentation updates must be proposed through reviewable repository changes.
9. The first version remains in one repository.
10. Extracting the broker into a separate service is future work and requires an ADR.

### Runtime state versus source of truth

Use Markdoc for:

```text
business vision
architecture
accepted decisions
agent contracts
workflow rules
permissions
human gates
roadmap
runbooks
approved terminology
```

Use runtime storage for:

```text
work-unit status
provider health
cooldowns
queue state
execution logs
model responses
test evidence
approval requests
current branches
current diffs
retry counts
```


## Required component: Intent and Prompt Translator

Build a first-class component named the **Intent and Prompt Translator**.

It may also be referred to internally as the Request Normalizer, but the user-facing name should remain understandable.

### Purpose

Convert the user's natural-language idea into a precise, model-independent work request without forcing the user to learn prompt engineering.

### Translator responsibilities

The translator must:

1. preserve the user's actual goal and wording
2. identify the requested business outcome
3. infer the likely workflow and responsible role
4. retrieve relevant Markdoc pages before finalizing the request
5. identify missing information
6. distinguish essential missing information from optional detail
7. ask only necessary clarification questions
8. make safe, reversible defaults when clarification is not essential
9. expose all assumptions
10. define concrete deliverables
11. generate testable acceptance criteria
12. capture constraints, non-goals, risks, dependencies, and approvals
13. recommend a provider preference without binding the broker
14. produce a concise user-facing interpretation
15. produce a machine-readable work-unit contract
16. never convert a vague request directly into unrestricted execution
17. never invent business facts, credentials, deadlines, budgets, or approvals

### Translator output

The translator must produce both a human-readable preview and structured JSON.

Human-readable preview:

```text
I understood your request as:

Goal:
Deliverables:
What is not included:
Assumptions:
Questions that must be answered:
Relevant company rules:
Recommended workflow:
Likely first agent:
Suggested provider:
Human approvals:
Definition of done:
```

Machine-readable work request:

```json
{
  "id": "generated-stable-id",
  "rawRequest": "The user's original request, preserved exactly",
  "normalizedGoal": "Clear outcome statement",
  "businessOutcome": "Why this work matters",
  "workflowType": "documentation | planning | architecture | implementation | review | operations | mixed",
  "requestedDeliverables": [],
  "acceptanceCriteria": [],
  "constraints": [],
  "nonGoals": [],
  "assumptions": [],
  "openQuestions": [],
  "dependencies": [],
  "risk": "low | medium | high | critical",
  "dataClassification": "public | internal | confidential | restricted",
  "requiredApprovals": [],
  "relevantDocs": [],
  "relevantAdrs": [],
  "recommendedFirstRole": "",
  "preferredProvider": "claude | codex | auto",
  "providerReason": "",
  "documentationImpactExpected": true,
  "status": "draft | ready-for-routing | waiting-for-user | waiting-for-approval"
}
```

### Clarification policy

Ask a question only when the answer materially affects:

- safety
- legal or privacy exposure
- spending
- architecture
- production systems
- destructive changes
- scope
- acceptance criteria
- irreversible decisions

For low-risk ambiguity, proceed using an explicit assumption and make it easy for the user to correct.

Do not overwhelm the user with a long questionnaire.

### Prompt compilation

After translation, compile a provider-specific execution prompt from the same structured work request.

Create separate adapters:

```text
ClaudePromptAdapter
CodexPromptAdapter
```

Each adapter may format instructions differently for the target tool, but both must receive the same:

- approved goal
- acceptance criteria
- Markdoc context package
- ADR constraints
- repository boundaries
- permissions
- evidence requirements
- stop conditions
- required output contract

Provider-specific prompts must not change the business meaning of the work request.

### Translator independence

The translator does not approve its own interpretation for high-risk work.

For high-risk or materially ambiguous requests:

1. translator produces the interpretation
2. user or authorized human confirms it
3. broker marks the work request ready
4. execution begins

For routine low-risk work, the translator may route automatically after showing the interpreted request in the activity record.

### Translator fallback

The translator itself must be provider-independent.

Preferred execution:

```text
Claude translator session
```

Fallback:

```text
Codex translator session
```

Both use the same translator contract and Markdoc retrieval process.

If neither provider is available, preserve the draft work request and report that execution is waiting for provider capacity.


## Content principles

The documentation must preserve these operating rules:

1. One role owns one deliverable.
2. Roles are stable; models are replaceable.
3. Claude and Codex may dynamically fill roles per work unit.
4. The other model provides an independent second voice.
5. No agent approves its own work.
6. Planning and review are read-only by default.
7. Implementation write access is limited to an isolated Git worktree.
8. Deterministic evidence comes before model judgment.
9. Failed tests or unresolved blockers cannot be outvoted.
10. Defects return to the role that owns the defective deliverable.
11. Retries are bounded.
12. Humans approve material architecture, spending, legal/privacy risk, production changes, merge, deployment, and release.
13. The broker owns routing, sequencing, policy enforcement, evidence collection, audit history, and completion state.
14. Workers cannot mark themselves complete.
15. Documentation is version controlled and is the canonical project memory.

## Required documentation information architecture

Use this as the target structure. Adapt only when the existing repository requires a better Astro content-collection layout.

```text
src/
├── components/
│   └── docs/
│       ├── AgentCard.astro
│       ├── ArchitectureDiagram.astro
│       ├── Callout.astro
│       ├── DecisionCard.astro
│       ├── DecisionTable.astro
│       ├── EvidencePanel.astro
│       ├── IntentPreview.astro
│       ├── ProviderDecision.astro
│       ├── SourceOfTruthNotice.astro
│       ├── HumanGate.astro
│       ├── RoleMatrix.astro
│       ├── SourceReference.astro
│       ├── StatusBadge.astro
│       ├── WorkflowStep.astro
│       └── WorkUnitExample.astro
├── content/
│   ├── config.ts
│   └── docs/
│       ├── index.mdoc
│       ├── getting-started/
│       │   ├── overview.mdoc
│       │   ├── repository-guide.mdoc
│       │   ├── local-development.mdoc
│       │   └── documentation-guide.mdoc
│       ├── product/
│       │   ├── vision.mdoc
│       │   ├── problem-and-outcomes.mdoc
│       │   ├── principles.mdoc
│       │   ├── terminology.mdoc
│       │   └── scope-and-non-goals.mdoc
│       ├── plans/
│       │   ├── roadmap.mdoc
│       │   ├── current-phase.mdoc
│       │   ├── milestones.mdoc
│       │   ├── capability-map.mdoc
│       │   └── future-work.mdoc
│       ├── architecture/
│       │   ├── overview.mdoc
│       │   ├── system-context.mdoc
│       │   ├── company-structure.mdoc
│       │   ├── broker-control-plane.mdoc
│       │   ├── worker-plane.mdoc
│       │   ├── broker-components.mdoc
│       │   ├── work-unit-contract.mdoc
│       │   ├── routing-and-scheduling.mdoc
│       │   ├── data-and-state.mdoc
│       │   ├── security-boundaries.mdoc
│       │   ├── observability-and-audit.mdoc
│       │   ├── deployment.mdoc
│       │   └── diagrams.mdoc
│       ├── agents/
│       │   ├── overview.mdoc
│       │   ├── universal-agent-contract.mdoc
│       │   ├── universal-handoff.mdoc
│       │   ├── chief-of-staff.mdoc
│       │   ├── program-manager.mdoc
│       │   ├── market-researcher.mdoc
│       │   ├── business-analyst.mdoc
│       │   ├── product-manager.mdoc
│       │   ├── ux-ui-designer.mdoc
│       │   ├── solution-architect.mdoc
│       │   ├── security-architect.mdoc
│       │   ├── codebase-researcher.mdoc
│       │   ├── code-writer.mdoc
│       │   ├── qa-engineer.mdoc
│       │   ├── pr-reviewer.mdoc
│       │   ├── devops-engineer.mdoc
│       │   ├── release-manager.mdoc
│       │   ├── business-growth-agents.mdoc
│       │   └── advanced-operations-agents.mdoc
│       ├── workflows/
│       │   ├── overview.mdoc
│       │   ├── end-to-end-business-workflow.mdoc
│       │   ├── broker-work-unit-lifecycle.mdoc
│       │   ├── planning-and-second-voice.mdoc
│       │   ├── implementation-and-diff-review.mdoc
│       │   ├── quality-gates.mdoc
│       │   ├── majority-convergence.mdoc
│       │   ├── bounded-repair-loop.mdoc
│       │   ├── human-approval-flow.mdoc
│       │   ├── release-flow.mdoc
│       │   └── operations-learning-loop.mdoc
│       ├── governance/
│       │   ├── permissions-and-least-privilege.mdoc
│       │   ├── model-independence.mdoc
│       │   ├── capacity-and-cost-routing.mdoc
│       │   ├── privacy-and-data-classification.mdoc
│       │   ├── evidence-policy.mdoc
│       │   ├── audit-policy.mdoc
│       │   └── human-authority.mdoc
│       ├── decisions/
│       │   ├── index.mdoc
│       │   ├── adr-template.mdoc
│       │   ├── 0001-use-astro.mdoc
│       │   ├── 0002-use-markdoc.mdoc
│       │   ├── 0003-use-central-broker.mdoc
│       │   ├── 0004-stable-roles-dynamic-models.mdoc
│       │   ├── 0005-independent-second-voice.mdoc
│       │   ├── 0006-deterministic-quality-gates.mdoc
│       │   ├── 0007-isolated-git-worktrees.mdoc
│       │   ├── 0008-human-approval-for-high-impact-actions.mdoc
│       │   ├── 0009-docs-as-code.mdoc
│       │   └── 0010-provider-adapter-boundary.mdoc
│       ├── operations/
│       │   ├── operating-model.mdoc
│       │   ├── configuration.mdoc
│       │   ├── model-health-and-cooldowns.mdoc
│       │   ├── monitoring.mdoc
│       │   ├── incident-response.mdoc
│       │   ├── backup-and-recovery.mdoc
│       │   └── release-runbook.mdoc
│       └── references/
│           ├── source-map.mdoc
│           ├── document-statuses.mdoc
│           ├── glossary.mdoc
│           └── open-questions.mdoc
├── layouts/
│   └── DocsLayout.astro
├── pages/
│   └── docs/
│       └── [...slug].astro
└── styles/
    └── docs.css

public/
└── diagrams/
    ├── source/
    ├── previews/
    └── exports/

markdoc.config.mjs
markdoc.config.json
```

## Markdoc implementation requirements

1. Check whether `@astrojs/markdoc` is already installed.
2. If absent, add it using the project’s existing package manager.
3. Configure the integration in `astro.config.*` without breaking existing integrations.
4. Create the Markdoc schema configuration.
5. Create an Astro content collection with validated frontmatter.
6. Use `.mdoc` content entries.
7. Add reusable Markdoc tags backed by Astro components.
8. Add editor configuration for Markdoc syntax support.
9. Keep content accessible when JavaScript is disabled.
10. Do not allow arbitrary unsafe HTML unless there is a documented reason.

Suggested frontmatter schema:

```yaml
---
title: ""
description: ""
section: ""
order: 0
status: draft
lastReviewed: YYYY-MM-DD
owners: []
sourceFiles: []
relatedAdrs: []
relatedPages: []
tags: []
---
```

Allowed documentation statuses:

- `draft`
- `under-review`
- `approved`
- `superseded`

## Required page experience

Build a readable documentation experience with:

- responsive left navigation
- mobile navigation drawer
- breadcrumbs
- in-page table of contents
- previous and next page links
- status badge
- page owner and last-reviewed metadata
- source references
- related ADRs
- related documentation links
- code blocks with copy affordance
- accessible tables
- callouts for:
  - note
  - decision
  - warning
  - human approval
  - security
  - unresolved question
- keyboard-visible focus states
- reduced-motion support
- print-friendly styling
- no horizontal overflow on normal content
- diagrams that can be enlarged or opened separately
- clear distinction between:
  - current implementation
  - target architecture
  - proposal
  - accepted decision
  - future capability

Use the HTML references for visual inspiration, but simplify them for long-form technical reading. Readability is more important than decorative animation.

## Diagram requirements

1. Preserve every supplied `.excalidraw` source file under `public/diagrams/source/`.
2. Preserve useful ZIP contents in an organized source folder or extract them into a generated/reference folder without deleting originals.
3. Use included preview PNG files where available.
4. Attempt deterministic local export to SVG or PNG only if a suitable repository-safe tool is already available or can be added reasonably.
5. Never fabricate an image export.
6. When export is not possible:
   - provide a preview if one exists
   - provide a link to the source `.excalidraw`
   - explain how to open it in Excalidraw or Excalidraw Animate
7. Create a diagram catalog page that states:
   - diagram purpose
   - source filename
   - architecture level
   - related pages
   - whether it is static or animated
8. Include easy-to-read textual alternatives for every important diagram.
9. Do not use one giant unreadable diagram as the only explanation. Split system, workflow, agent, security, deployment, and sequence views.

## Agent page contract

Every individual agent page must include:

- purpose
- business department or lane
- single responsibility
- when to use the agent
- approved inputs
- required output/document
- allowed tools
- prohibited actions
- write-access level
- required evidence
- acceptance criteria
- stop condition
- second-voice review
- human approval rule
- defect return target
- recommended next agent
- failure and escalation behavior
- example universal handoff
- source references

Do not permanently label Claude as architect and Codex as coder. Document roles separately from model providers.


## Required component: Provider Router and Capacity Manager

Build the routing policy as an explicit, testable service rather than hiding it inside prompts.

### Routing priority

Use this decision order:

```text
1. Policy and data eligibility
2. Required tool and repository capability
3. User's explicit provider request
4. Claude-first preference
5. Task affinity
6. Current provider health and cooldown
7. Available capacity and operator overrides
8. Existing repository/context advantage
9. Historical quality and failure rate
10. Latency and cost considerations
```

Policy eligibility always overrides preference.

### Example policy

```text
Business planning                 → prefer Claude
Product and architecture          → prefer Claude
Markdoc documentation             → prefer Claude
Codebase research                 → auto, based on repository context
Implementation and debugging      → prefer Codex when eligible
Test generation and execution     → prefer Codex when eligible
Independent critique              → use the provider that did not author
Security or PR review             → fresh independent session
Provider exhausted or limited     → route to healthy fallback
User explicitly requests provider → honor when policy permits
```

This is an initial policy, not a permanent claim that one provider is universally better.

### Capacity state

Track:

```json
{
  "provider": "claude",
  "health": "healthy | degraded | rate-limited | unavailable",
  "cooldownUntil": null,
  "manualCapacity": 1.0,
  "recentFailures": 0,
  "activeWorkUnits": 0,
  "estimatedContextPressure": 0.0,
  "lastSuccessfulRun": null
}
```

Consumer subscription capacity may not expose an exact remaining-token API.

The broker must use:

- observed failures
- response headers when available
- cooldown timers
- recent usage estimates
- queue pressure
- operator capacity override
- successful completion history

Do not display a fabricated exact remaining allowance.

### Handoff between Claude and Codex

When switching providers, create a provider-neutral continuation package:

```text
Work-unit JSON
Original user request
Normalized goal
Approved Markdoc context
Accepted ADR constraints
Files inspected
Files changed
Current diff
Commands already run
Test evidence
Decisions made
Assumptions
Open blockers
Required next action
Stop condition
```

The fallback provider must continue from this package rather than reconstructing the task from raw chat.


## Broker architecture content

Document at minimum:

- Chief of Staff versus broker responsibilities
- work-unit queue
- router and scheduler
- model registry
- context packager
- orchestrator/execution manager
- permission policy
- gate engine
- review panel
- audit and results store
- human approval service
- provider health and cooldown
- usage and capacity tracking
- manual capacity overrides
- isolated Git worktrees
- branch and pull-request preparation
- bounded repair
- deterministic gates
- 2-of-3 panel convergence
- blocker rules
- no silent merge or deployment

Include the work-unit contract as a real validated example:

```json
{
  "id": "contact-form",
  "goal": "Create a production-ready contact form",
  "acceptanceCriteria": [
    "validates input",
    "tests pass"
  ],
  "constraints": [
    "follow existing Astro architecture"
  ],
  "risk": "medium",
  "preferredProvider": "auto",
  "dependencies": []
}
```

## ADR requirements

Use one decision per ADR.

Every ADR must include:

- title
- status
- date
- context
- decision drivers
- options considered
- decision
- positive consequences
- negative consequences
- risks
- follow-up work
- supersedes / superseded-by when applicable
- source references

Do not claim an ADR is accepted merely because it is proposed in source material.

Use this rule:

- If clearly implemented and established in the repository: `accepted`
- If described as target architecture but not yet implemented: `proposed`
- If evidence is insufficient: `draft`

Create an ADR index with filters or clear grouped sections by status.

## Roadmap requirements

The roadmap must clearly separate:

- completed
- currently implemented
- in progress
- planned
- exploratory

Do not invent dates, budgets, owners, or completion percentages.

Derive planned capabilities from the source materials, including:

- documentation foundation
- broker prototype
- one-agent execution
- multi-agent orchestration
- second-voice review
- deterministic quality gates
- isolated worktrees
- human approval service
- audit and results store
- provider adapters
- capacity-aware routing
- production observability
- operations and learning loop

When the source material does not establish timing, use phase-based sequencing rather than dates.

## Provenance and truthfulness

Create `references/source-map.mdoc`.

For every important claim, record its source file.

At the bottom of each page, include a source section generated from frontmatter or content.

When sources conflict:

1. state the conflict
2. identify each source
3. prefer current repository behavior for “current state”
4. preserve source proposals as “target state”
5. add the unresolved decision to `references/open-questions.mdoc`

Do not invent product features, implementation status, test results, or operational guarantees.

## Search

Use the lightest maintainable search solution compatible with the existing stack.

Preference order:

1. existing project search
2. generated client-side index
3. a small maintained package

Do not add a hosted search dependency or external service without an ADR.

## Quality and validation

Before completion:

1. Run the project’s actual install command when needed.
2. Run all existing applicable commands:
   - format
   - lint
   - typecheck
   - unit tests
   - integration tests
   - build
3. Fix errors caused by your changes.
4. Do not weaken tests, validation, security settings, or TypeScript strictness to force success.
5. Check for broken internal links.
6. Check duplicate slugs and navigation entries.
7. Validate all content frontmatter.
8. Check responsive behavior.
9. Check keyboard navigation and accessibility basics.
10. Confirm that unrelated existing pages still build.


## Required translator and router implementation deliverables

The completed implementation must also include:

1. a typed work-request schema
2. validation for translator output
3. an Intent and Prompt Translator service or module
4. Claude and Codex prompt adapters
5. a provider-routing policy module
6. provider health and manual-capacity state
7. provider-neutral continuation package generation
8. a visible interpretation preview in the user workflow
9. Markdoc retrieval hooks for relevant pages and ADRs
10. documentation-impact evaluation after each work unit
11. tests for:
    - vague request normalization
    - assumption disclosure
    - required clarification
    - Claude-first preference
    - Codex task-affinity selection
    - Claude capacity fallback to Codex
    - Codex capacity fallback to Claude
    - user provider override
    - policy override
    - independent reviewer selection
    - continuation package completeness
    - Markdoc conflict detection
12. example fixtures using realistic user requests written in informal language

The first working vertical slice should support:

```text
Natural-language request
→ translated work request
→ relevant Markdoc context
→ routing recommendation
→ provider-specific prompt preview
→ simulated execution status
→ documentation-impact result
```

When live Claude or Codex invocation is not yet wired, build and test the interfaces, state machine, adapters, and simulation layer without pretending that real provider execution occurred.


## Deliverables

At completion, provide:

1. `docs-build-plan.md`
2. working Astro + Markdoc documentation implementation
3. complete `.mdoc` documentation corpus
4. reusable Markdoc/Astro components
5. diagram source and preview organization
6. ADR library and template
7. roadmap and open-questions pages
8. source-provenance map
9. navigation configuration
10. build/test evidence
11. `docs-implementation-report.md` containing:
    - summary
    - files created
    - files modified
    - dependencies added
    - extraction methods used
    - diagrams successfully rendered
    - diagrams linked as source only
    - commands run and results
    - unresolved issues
    - recommended next work unit

## Safety and repository boundaries

- Work only inside this repository.
- Do not use production credentials.
- Do not deploy.
- Do not merge.
- Do not push unless explicitly authorized.
- Do not delete original reference files.
- Do not modify generated lockfiles manually.
- Do not fabricate citations, source content, screenshots, or build results.
- Do not replace the existing application with a generic docs starter.
- Preserve the current brand unless a documentation-specific extension is required.
- Keep changes reviewable and logically organized.

## Execution order

Execute in this order:

1. Locate relevant files in `~/Downloads`
2. Safely copy and hash them into `reference/source-materials/originals/`
3. Generate source inventory JSON and Markdown
4. Repository assessment and source inspection
5. Content/source authority map
6. `docs-build-plan.md`
7. Markdoc/Astro configuration
8. typed work-request schema
9. Intent and Prompt Translator
10. Markdoc retrieval/context packaging
11. Claude and Codex prompt adapters
12. provider router, health, capacity, and continuation state
13. content schema and route
14. docs layout and navigation
15. reusable components
16. core overview and architecture pages
17. agent pages
18. workflow and governance pages
19. ADRs
20. roadmap, operations, and references
21. diagram integration
22. search and polish
23. validation and broken-link checks
24. `docs-implementation-report.md`


## Final acceptance criteria for the whole project

The project is complete only when all of the following are true:

1. Relevant source files were safely discovered in `~/Downloads`.
2. Repository-local source copies and inventories were created.
3. Astro + Markdoc documentation builds successfully.
4. Markdoc is clearly documented and implemented as the canonical source of truth.
5. The separate `src/modules/orchestration/` boundary exists.
6. A typed natural-language work-request schema exists.
7. The Intent and Prompt Translator works with informal requests.
8. Relevant Markdoc context and ADRs are attached to work requests.
9. Claude-first preference is implemented as configuration, not permanent role identity.
10. Codex is selected for suitable code work, fallback, explicit request, or independent review.
11. Provider health, cooldown, and manual capacity overrides exist.
12. Provider-neutral continuation packages preserve work across Claude/Codex switches.
13. The user does not need to rewrite a request when a provider changes.
14. High-risk ambiguity requires human confirmation.
15. Deterministic checks cannot be overruled by model confidence.
16. A provider/session cannot independently approve its own output.
17. Documentation impact is evaluated for every completed work unit.
18. ADR status is truthful and evidence-based.
19. Tests cover translator, routing, fallback, continuation, conflict detection, and documentation impact.
20. Existing unrelated Beacon features still build.
21. `docs-build-plan.md` exists.
22. `docs-implementation-report.md` exists with real command evidence.
23. Any unimplemented live-provider integration is clearly marked as simulated rather than falsely reported as complete.


Begin now. Inspect everything first, preserve existing work, and continue until the documentation site builds successfully or a clearly documented external blocker prevents completion.
