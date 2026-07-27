import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const contentRoot = join(root, "src", "content", "docs");
const reviewed = "2026-07-27";

const sectionOrder = {
  home: 0,
  "getting-started": 100,
  product: 200,
  plans: 300,
  architecture: 400,
  agents: 500,
  workflows: 600,
  governance: 700,
  decisions: 800,
  operations: 900,
  references: 1000,
};

function frontmatter(page) {
  const data = {
    title: page.title,
    description: page.description,
    section: page.section,
    order: page.order,
    status: page.status ?? "approved",
    lastReviewed: reviewed,
    owners: page.owners ?? ["Knowledge Manager"],
    sourceFiles: page.sourceFiles ?? [],
    relatedAdrs: page.relatedAdrs ?? [],
    relatedPages: page.relatedPages ?? [],
    tags: page.tags ?? [],
    truthState: page.truthState ?? "reference",
  };
  return `---\n${Object.entries(data)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join("\n")}\n---\n`;
}

const pages = [];
function add(path, page, body) {
  pages.push({ path: `${path}.mdoc`, content: `${frontmatter(page)}\n${body.trim()}\n` });
}

const coreSources = [
  "BEACON_COMPLETE_EXECUTION_PROMPT.md",
  "reference/source-materials/originals/Claude_Multi_Agent_Business_Guide.pdf",
  "reference/source-materials/originals/Claude_Codex_Broker_Addendum.docx",
];
const repoSources = ["AGENTS.md", "docs/current-state.md", "docs/architecture.md"];
const architectureSources = [
  ...coreSources,
  "reference/source-materials/originals/ai_company_all_agents_and_combined_canvas.excalidraw",
  "reference/source-materials/originals/easy_read_ai_company_architecture.excalidraw",
  "reference/source-materials/originals/individual_agent_architecture_animated.excalidraw",
  "reference/source-materials/originals/unified_agent_operating_architecture_all_in_one.excalidraw",
  "reference/source-materials/extracted/broker-package/multi_agent_business_broker_end_to_end.excalidraw",
];

add("index", {
  title: "Beacon Decision System",
  description: "The canonical, source-backed project memory for Beacon & Co.",
  section: "home",
  order: 0,
  truthState: "current",
  sourceFiles: [...coreSources, ...repoSources],
  relatedAdrs: ["0001-why-beacon-exists-and-business-definition", "0002-define-brand-and-customer-experience", "0003-record-architecture-evolution-and-source-atlas", "0006-use-markdoc"],
  relatedPages: ["getting-started/overview", "plans/current-phase", "architecture/overview", "references/source-map"],
  tags: ["source-of-truth", "overview", "beacon"],
}, `
{% source_of_truth state="current" label="Canonical project memory" %}
Markdoc in this repository is the source of truth for business direction, product rules, architecture, roles, workflows, decisions, and operating policy. Runtime state and chat history do not replace it.
{% /source_of_truth %}

## Start with the current boundary

Beacon & Co. is a solo-operated digital-presence business serving locally owned businesses around Waynesboro, Virginia. The implemented product is a static Astro marketing site plus one narrow Cloudflare Worker contact route.

The orchestration module documented here is an **in-memory simulation**. It validates requests, retrieves Markdoc context, recommends a provider, compiles provider-specific prompt previews, models gates, and proposes documentation updates. It does not call Claude or Codex, create a durable queue, open worktrees, merge, deploy, or store runtime state in Markdoc.

| Read next | Use it for |
|---|---|
| [Current phase](/docs/plans/current-phase/) | What exists and what does not |
| [Product vision](/docs/product/vision/) | Why the business and system exist |
| [Architecture overview](/docs/architecture/overview/) | Current application and target broker boundaries |
| [Agent organization](/docs/agents/overview/) | Stable roles and responsibilities |
| [Workflow overview](/docs/workflows/overview/) | Sequential delivery and review |
| [Decision book](/docs/decisions/) | Why governing choices were made |
| [Source map](/docs/references/source-map/) | Provenance and authority |

## The operating rule

One role owns one deliverable. Models are replaceable workers. Evidence comes before model confidence. A worker cannot approve its own output, failed deterministic gates cannot be outvoted, and an authorized human owns consequential decisions.

{% callout type="warning" title="Truth boundary" %}
“Accepted” describes a governing decision. “Current” describes verified repository behavior. “Target” and “proposal” do not claim production implementation.
{% /callout %}
`);

const gettingStarted = [
  ["overview", "Overview", "How to read and use the Beacon source of truth.", `
## What this system contains

The repository has three deliberately different surfaces:

1. the marketing application at \`/\`;
2. the canonical Markdoc handbook at \`/docs\`;
3. the simulated orchestration workspace at \`/workspace\`.

The handbook records stable business, product, architecture, agent, workflow, governance, operations, and decision knowledge. The workspace shows how ordinary language becomes a safe work request without requiring prompt-engineering expertise.

## Reading order

Read [Current phase](/docs/plans/current-phase/) before reporting status. Read the controlling ADR before changing direction. Read agent and workflow contracts before assigning work. Read the source map when a claim’s authority is unclear.
`],
  ["repository-guide", "Repository guide", "Where implementation, documentation, orchestration, and evidence live.", `
## Primary paths

| Path | Responsibility |
|---|---|
| \`src/pages/index.astro\` | Marketing entry |
| \`src/components/\` | Marketing, docs, and workspace components |
| \`src/content/docs/\` | Canonical Markdoc content |
| \`src/modules/orchestration/\` | Provider-neutral simulation and policy |
| \`public/diagrams/\` | Public diagram sources, previews, and exports |
| \`reference/source-materials/\` | Hashed original and extracted evidence |
| \`tests/orchestration/\` | Translator, retrieval, routing, continuation, and impact tests |
| \`docs/\` | Retained pre-Markdoc handbook evidence during migration |

## Shared instructions

\`AGENTS.md\` is the durable repository rule set. \`CLAUDE.md\` must continue to resolve to the same instructions. A handoff is a compact pointer to this repository state, not a transcript.
`],
  ["local-development", "Local development", "Install, run, test, and build the repository locally.", `
## Prerequisites

- Node.js 22.12 or later
- npm
- Python only for retained MkDocs validation

## Commands

\`\`\`sh
npm install
npm run dev
npm run test
npm run typecheck
npm run docs:validate
npm run build
npm run preview
\`\`\`

Astro serves the marketing site, documentation, and workspace together. Static output is written to \`dist/\`.

{% callout type="note" title="Provider simulation" %}
No Claude or Codex API key is required. Provider adapters compile a prompt preview and return a clearly labeled simulated result.
{% /callout %}
`],
  ["documentation-guide", "Documentation guide", "How to author, review, link, and validate canonical Markdoc pages.", `
## Authoring contract

Every page uses \`.mdoc\`, validated frontmatter, a truthful status, a review date, an owner, sources, related decisions, and related pages. Use controlled Markdoc tags instead of arbitrary HTML.

## Change rule

A material change updates the relevant living page and a change record or ADR. Use one decision per ADR. Do not silently rewrite accepted history; supersede it and link both records.

## Statuses

- \`draft\`: incomplete or insufficient evidence
- \`under-review\`: review is active
- \`approved\`: governs project work
- \`superseded\`: retained history, no longer governing

Run \`npm run docs:validate\` and \`npm run build\` after material documentation changes.
`],
];
gettingStarted.forEach(([slug, title, description, body], index) =>
  add(`getting-started/${slug}`, {
    title, description, section: "getting-started",
    order: sectionOrder["getting-started"] + index,
    truthState: "current", sourceFiles: ["BEACON_COMPLETE_EXECUTION_PROMPT.md", "AGENTS.md", "package.json"],
    relatedAdrs: ["0006-use-markdoc", "0013-use-docs-as-code"],
    relatedPages: ["references/document-statuses"], tags: ["getting-started"],
  }, body),
);

const productPages = [
  ["vision", "Product and business vision", "Why Beacon exists, who it serves, and what outcome the system must support.", `
## Founding observation

Good local businesses around Waynesboro, Staunton, Fishersville, and nearby communities can be difficult to find online even when their real-world reputation is strong. Beacon began with a bounded question: can one useful website or profile improvement help one local owner become easier to find?

## Business definition

Beacon & Co. is a solo-operated digital-presence service for locally owned small businesses within roughly 30 miles of Waynesboro, Virginia. It begins with a useful free audit, recommends the smallest fitting paid service, and earns a recurring relationship through visible results.

Two human moments remain deliberate: the founder conducts the sales conversation, and the client approves drafted content before publication.

## Current offer

| Offer | Working price | Role |
|---|---:|---|
| Spark | $299 one time | Google profile and review-system entry |
| Website | From $799 | Client-owned static site |
| Presence | $450/month plus setup | Website, Google, social, reviews, report |
| Authority | $750/month plus setup | Presence plus broader local SEO and strategy |

Prices are current site offers, not proof of margin. The brand name remains provisional pending formal clearance.
`],
  ["problem-and-outcomes", "Problem and outcomes", "The user problem, company outcome, and evidence boundaries.", `
## Customer problem

The intended customer is credible offline but incomplete online, wants founder access and plain language, and cannot justify a traditional agency retainer.

## Outcomes

- make the business easier to find and trust;
- make the smallest useful fix clear;
- give the owner control of files and consequential approvals;
- show delivered value in understandable terms;
- learn manually before automating recurring work.

## Evidence boundary

Market counts, competitor prices, margins, churn, capacity, and acquisition economics in prior proposal material are hypotheses until revalidated. Named businesses are research leads, not customers or endorsements.
`],
  ["principles", "Product and experience principles", "The brand, CTA, imagery, accessibility, and motion rules all surfaces preserve.", `
## Experience rules

1. One clear primary action per screen.
2. Put the plain-language promise in the high-value reading area.
3. Support claims with a deliverable, source, price boundary, or real example.
4. Use real local photography with permission or labeled neutral placeholders.
5. Never use generated stock people or testimonial avatars.
6. Keep keyboard focus visible and tables, code, and diagrams usable at narrow widths.
7. Every animation respects \`prefers-reduced-motion\`.
8. Never use \`localStorage\` or \`sessionStorage\`.

The documentation experience favors long-form readability over decorative animation while retaining the forest, sage, gold, cream, ink, and rule palette.
`],
  ["terminology", "Approved terminology", "Names that keep roles, providers, state, and truth boundaries precise.", `
| Term | Meaning |
|---|---|
| Role | Stable responsibility that owns one deliverable |
| Provider | Replaceable execution system such as Claude or Codex |
| Session | One provider context; an authoring session cannot review itself |
| Work request | Validated, provider-neutral interpretation of the user request |
| Work unit | Bounded executable package with criteria, constraints, risk, and dependencies |
| Broker | Deterministic routing, sequencing, policy, evidence, and completion control |
| Second voice | Independent provider critique; not automatic approval |
| Markdoc | Version-controlled canonical project memory |
| Runtime state | Queue, health, logs, approvals, retries, and current run evidence |
| Simulated | Interface and state behavior exercised without a live provider invocation |
`],
  ["scope-and-non-goals", "Scope and non-goals", "What this implementation includes and what remains intentionally absent.", `
## In scope

- Astro + Markdoc source-of-truth site;
- source inventory, provenance, search, and diagrams;
- typed request translation and context retrieval;
- configurable routing, capacity, health, fallback, and continuation;
- prompt previews for Claude and Codex;
- in-memory workflows, approvals, evidence, and audit;
- documentation-impact proposals;
- automated tests and a visible simulation workspace.

## Not in scope

- live Claude or Codex invocation;
- durable database, queue, or approval service;
- autonomous workers or background execution;
- real Git worktree creation;
- automatic commits, pull requests, merge, push, deployment, or release;
- production observability or secrets;
- runtime edits to canonical Markdoc.
`],
];
productPages.forEach(([slug, title, description, body], index) =>
  add(`product/${slug}`, {
    title, description, section: "product", order: sectionOrder.product + index,
    truthState: slug === "scope-and-non-goals" ? "current" : "decision",
    sourceFiles: slug === "vision"
      ? ["docs/decisions/0001-why-beacon-exists-and-business-definition.md", "docs/business/plan.md", "src/components/PricingCards.astro"]
      : ["docs/decisions/0002-define-brand-and-customer-experience.md", "BEACON_COMPLETE_EXECUTION_PROMPT.md"],
    relatedAdrs: ["0001-why-beacon-exists-and-business-definition", "0002-define-brand-and-customer-experience"],
    relatedPages: ["plans/current-phase"], tags: ["product"],
  }, body),
);

const planPages = [
  ["roadmap", "Roadmap", "Phase-based capability sequence without invented dates, budgets, or completion percentages.", `
## Completed

- Phase 1 marketing site and narrow contact Worker
- safe source import, hashing, extraction, and assessment
- Markdoc documentation foundation
- orchestration interfaces and simulated first vertical slice

## Currently implemented

- canonical Markdoc content collection, routes, navigation, search, and components
- typed translator, retriever, router, capacity manager, adapters, workflows, approvals, audit, and impact analyzer
- test fixtures and deterministic validation

## Planned

1. validate one low-risk work unit using the simulation;
2. add real isolated worktree execution only after a separate approval and threat review;
3. integrate one live provider behind the adapter contract;
4. add the independent second provider;
5. introduce durable audit/runtime storage only when repeated volume justifies it;
6. add operations instrumentation before production use.

## Exploratory

Additional providers, queue scaling, safe parallelism, automated pull-request preparation, and a separately deployed broker service require new evidence and ADRs.
`],
  ["current-phase", "Current phase", "Verified repository state and explicit target boundaries.", `
## Current implementation

The repository builds a static Astro marketing site, a Markdoc documentation site, a simulated workspace, and a narrow Cloudflare Worker contact handler.

## Simulated orchestration

The orchestration module executes typed local logic only. Its adapters create prompt previews. Its stores are in-memory. It does not run provider CLIs, alter Git branches, persist jobs, send messages, or perform production actions.

## Target architecture

The supplied Tier 1 sources define a brokered company with durable work units, isolated worktrees, real deterministic commands, fresh independent reviewers, majority convergence, human approvals, and auditable outcomes. Those capabilities remain target state unless a current page and test prove otherwise.
`],
  ["milestones", "Capability milestones", "Evidence-based exit gates for growing from documentation to controlled orchestration.", `
| Milestone | Exit evidence |
|---|---|
| Documentation foundation | Schema, navigation, links, search, and static build pass |
| Broker prototype | Informal request reaches a simulated impact result |
| One-agent execution | One live provider runs one bounded low-risk unit with full audit |
| Second voice | Other provider reviews without sharing the author session |
| Deterministic gates | Real repository commands block completion on failure |
| Worktree isolation | Changes occur only in a verified isolated worktree |
| Human approval service | High-impact state cannot advance without recorded authority |
| Operations loop | Health, failure, cost, latency, and outcomes are measured |
`],
  ["capability-map", "Capability map", "Current, simulated, proposed, and future capabilities in one map.", `
| Capability | State | Evidence |
|---|---|---|
| Marketing experience | Current | Astro source and build |
| Contact notification | Current | Cloudflare Worker source |
| Markdoc source of truth | Current | Content collection and docs routes |
| Natural-language translation | Simulated/local | Unit tests and workspace |
| Markdoc retrieval | Simulated/local | Reader, index, retriever tests |
| Claude/Codex routing | Simulated/local | Policy and fallback tests |
| Prompt compilation | Simulated/local | Provider adapter tests |
| Provider invocation | Proposed | No credentials or CLI execution |
| Durable queue/audit | Proposed | In-memory interfaces only |
| Isolated worktrees | Proposed | Policy documented; no executor |
| Merge/deploy/release | Human-only future | Explicitly outside this work unit |
`],
  ["future-work", "Future work", "Unimplemented capabilities that require a new bounded decision and authorization.", `
## Next safe work

The next unit should validate the local simulation against one low-risk documentation change, record usability findings, and refine translation without adding live credentials.

## Later

- one live provider adapter with a timeout, policy envelope, and evidence capture;
- a second provider and independent-review enforcement;
- real command gates in an isolated worktree;
- durable runtime and approval storage;
- operational dashboards, budget controls, and incident recovery;
- broker extraction into a separate service.

Each item requires its own threat, cost, rollback, and human-approval decision.
`],
];
planPages.forEach(([slug, title, description, body], index) =>
  add(`plans/${slug}`, {
    title, description, section: "plans", order: sectionOrder.plans + index,
    truthState: slug === "current-phase" || slug === "capability-map" ? "current" : "target",
    sourceFiles: ["BEACON_COMPLETE_EXECUTION_PROMPT.md", "docs/roadmap.md", "docs/current-state.md"],
    relatedAdrs: ["0003-record-architecture-evolution-and-source-atlas", "0007-use-central-broker"],
    relatedPages: ["architecture/overview"], tags: ["roadmap", "phase"],
  }, body),
);

const architecturePages = [
  ["overview", "Architecture overview", "Current Astro application, canonical Markdoc, and separate orchestration module.", `
{% source_of_truth state="current" label="Implemented boundary" %}
The current repository contains an Astro application, a Markdoc source of truth, and a separate in-memory orchestration module. Live provider execution and durable runtime infrastructure are not implemented.
{% /source_of_truth %}

## Current repository boundary

\`\`\`text
Beacon-Co
├── Astro application
│   ├── marketing site
│   ├── /docs Markdoc renderer
│   └── /workspace simulation
├── Markdoc source of truth
└── orchestration module
    ├── translator + knowledge retriever
    ├── broker + provider adapters
    ├── workflows + approvals
    └── audit + documentation impact
\`\`\`

## Target broker boundary

The target adds durable work units, execution management, isolated worktrees, real quality commands, fresh review sessions, provider invocation, persistent audit, and controlled pull-request preparation. No target element should be read as current merely because it appears in a diagram.

{% architecture_diagram src="/diagrams/exports/beacon-system-static.svg" source="/diagrams/source/beacon-system.excalidraw" alt="Current Beacon marketing and contact architecture" caption="Current static application and narrow contact route." /%}
`],
  ["system-context", "System context", "People, canonical knowledge, control plane, worker plane, and external boundaries.", `
## Context

The owner supplies a business goal or request. The translator creates a work request and retrieves approved Markdoc. The broker applies policy and selects an eligible provider. Workers produce one bounded deliverable. Deterministic gates, independent review, and human authority control completion.

\`\`\`text
Owner
  → Intent and Prompt Translator
  → Markdoc context package
  → Broker control plane
  → Claude or Codex worker plane
  → gates + independent review
  → human decision where required
  → reviewable result and documentation proposal
\`\`\`

The current implementation stops at simulation and prompt preview.

{% mermaid_diagram src="/diagrams/mermaid/broker-system-context.mmd" title="Broker system context" /%}
`],
  ["company-structure", "Company structure", "Stable departments and roles with dynamic model assignment.", `
## Company lanes

| Lane | Roles |
|---|---|
| Leadership | Owner, Chief of Staff, Program Manager |
| Business | Market Researcher, Business Analyst |
| Product and design | Product Manager, UX/UI Designer |
| Architecture and security | Solution Architect, Security Architect |
| Engineering | Codebase Researcher, Code Writer |
| Quality | QA Engineer, PR Reviewer |
| Delivery | DevOps Engineer, Release Manager |
| Operations | Support, Success, BI, SRE, Incident Commander |

Roles are stable contracts. Claude and Codex are dynamically assigned providers, never permanent departments.

{% architecture_diagram src="/diagrams/previews/ai-company-contact-sheet.png" source="/diagrams/source/ai_company_all_agents_and_combined_canvas.excalidraw" alt="Contact sheet of the supplied multi-agent company architecture" caption="Tier 1 organization and workflow source." /%}
`],
  ["broker-control-plane", "Broker control plane", "Deterministic management responsibilities above provider workers.", `
## Responsibilities

The broker owns queue semantics, dependency state, routing, health, capacity, policy, context packaging, sequencing, retry limits, evidence collection, audit history, approvals, and completion state.

The Chief of Staff interprets the business workflow; the broker enforces the resulting operational contract. Neither replaces the specialist who owns a deliverable.

## Current versus target

Current code implements typed routing, health/capacity, continuation, audit events, approval policy, and simulated execution in memory. Durable queueing, process execution, provider calls, worktrees, and persistent audit remain target capabilities.

{% mermaid_diagram src="/diagrams/mermaid/broker-control-plane.mmd" title="Broker control-plane relationships" /%}
`],
  ["worker-plane", "Worker plane", "Claude and Codex as bounded, replaceable role executors.", `
## Worker contract

A worker receives one approved work unit, the smallest approved context package, repository boundaries, permissions, evidence requirements, stop conditions, and a fixed output contract.

Planning and review are read-only. An implementation worker may eventually write only in an assigned isolated worktree. A worker cannot mark itself complete, create uncontrolled subagents, merge, push, deploy, or use production credentials.

## Provider equality

Either Claude or Codex may plan, implement, test, or review when eligible. The exact session that authored a deliverable cannot count as its independent reviewer.
`],
  ["broker-components", "Broker components", "Queue, router, registry, packager, execution, gates, review, audit, and approval services.", `
| Component | Responsibility | Current state |
|---|---|---|
| Work-unit queue | Priority, dependencies, retry, status | Interface/target |
| Router and scheduler | Eligibility, score, assignment, fallback | Simulated |
| Model registry | Capabilities, tools, health, data policy | Simulated |
| Context packager | Approved request, Markdoc, ADRs, evidence | Simulated |
| Execution manager | Worktree, CLI, timeout, capture | Proposed |
| Permission policy | Read/write boundaries and denied actions | Simulated policy |
| Gate engine | Real tests, build, scans | Contract only |
| Review panel | Structured independent votes | Completion policy only |
| Audit/results store | Decisions, runs, costs, artifacts | In-memory |
| Human approval | Pause consequential actions | In-memory |
`],
  ["work-unit-contract", "Work-unit contract", "The validated package that crosses translator, broker, provider, review, and continuation boundaries.", `
## Required contract

{% work_unit title="Contact form example" %}
\`\`\`json
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
\`\`\`
{% /work_unit %}

The full schema also preserves the raw request, business outcome, workflow, non-goals, assumptions, questions, classification, approvals, relevant documents and ADRs, first role, provider reason, documentation expectation, and routing status.
`],
  ["routing-and-scheduling", "Routing and scheduling", "Policy-first, capability-aware, Claude-first routing with Codex affinity and fallback.", `
## Decision order

1. policy and data eligibility;
2. required tool and repository capability;
3. explicit user provider request;
4. configurable Claude-first preference;
5. task affinity;
6. health and cooldown;
7. capacity and operator override;
8. repository context advantage;
9. quality and failure history;
10. latency and cost.

Policy always overrides preference. Documentation, planning, and architecture prefer Claude by configuration. Implementation and tests give Codex an affinity score. Review selects a provider other than the author.

Exact consumer-subscription allowance is not available reliably, so the system never fabricates tokens remaining.
`],
  ["data-and-state", "Data and state", "Why Markdoc stores approved knowledge while runtime stores execution state.", `
## Markdoc stores

Business vision, architecture, decisions, agent contracts, workflows, permissions, gates, roadmap, runbooks, and terminology.

## Runtime stores

Work-unit status, provider health, cooldowns, queue state, execution logs, responses, test evidence, approvals, branches, diffs, and retry count.

Runtime state cannot silently rewrite approved Markdoc. Documentation updates are proposed as repository changes and reviewed normally.
`],
  ["security-boundaries", "Security boundaries", "Least privilege, data policy, provider eligibility, worktree isolation, and human authority.", `
## Boundaries

- data classification is part of every work request;
- a provider is rejected before scoring if policy or capability is insufficient;
- planning and review are read-only;
- future implementation writes only inside one isolated worktree;
- secrets and production credentials are never included in Markdoc context;
- workers cannot push, merge, deploy, or approve their own work;
- legal, privacy, spending, architecture, and production risk stop at a human gate.

{% human_gate kind="security and production" %}
High-risk ambiguity must be confirmed before routing. A confident model response does not replace authorization.
{% /human_gate %}

{% mermaid_diagram src="/diagrams/mermaid/security-boundaries.mmd" title="Security and permission boundaries" /%}
`],
  ["observability-and-audit", "Observability and audit", "Evidence that makes routing, provider changes, gates, approvals, and outcomes traceable.", `
## Required evidence

The broker records request interpretation, context documents, routing scores, provider selection, fallback, run/session identity, commands, usage when reported, gate results, review verdicts, retry count, approvals, changed artifacts, and documentation impact.

Current stores are in memory for simulation. Production observability is proposed and must avoid raw secrets or unnecessary personal data.
`],
  ["deployment", "Deployment architecture", "Current static deployment shape and future orchestration separation.", `
## Current

Astro builds static assets compatible with the existing Cloudflare Worker deployment. The Worker serves assets and handles the narrow \`POST /api/contact\` route.

## Not deployed

The workspace and orchestration module are static/local demonstrations. No provider runtime, queue, database, broker service, or production approval service is deployed.

## Future boundary

Extracting the broker into a separate service requires a new ADR, authenticated control plane, persistent state, secrets policy, recovery plan, and operational evidence.

{% mermaid_diagram src="/diagrams/mermaid/deployment-boundary.mmd" title="Current and future deployment boundary" /%}
`],
  ["diagrams", "Diagram catalog", "Purpose, source, level, status, preview, and textual alternative for every supplied architecture scene.", `
## Supplied sources

| Diagram | Architecture level | Availability |
|---|---|---|
| Combined all-agents canvas | Company, broker, workflow, individual roles | Source + contact-sheet preview; animation metadata |
| Easy-read architecture | Unified flow, company lanes, agent pattern | Source; animation metadata |
| Individual-agent architecture | 14 roles and seven-step internal flow | Source; animation metadata |
| Unified all-in-one architecture | System, company, and role flows | Source; animation metadata |
| Broker end-to-end | Control plane and execution lifecycle | Source + preview; animation metadata |

{% architecture_diagram src="/diagrams/previews/broker-end-to-end.png" source="/diagrams/source/multi_agent_business_broker_end_to_end.excalidraw" alt="End-to-end multi-agent broker architecture preview" caption="Broker package preview supplied with Tier 1 source." /%}

## Text alternative

An owner request moves through intake, business definition, product, UX, architecture, security, and repository research. An approved work unit enters the broker. The broker chooses a provider, reserves the other provider for critique, isolates implementation, runs real checks, gathers fresh reviews, returns defects to the owning role, and stops at human release authority.

## Open and animate

Open any \`.excalidraw\` file in [Excalidraw](https://excalidraw.com/) for editing or [Excalidraw Animate](https://dai-shi.github.io/excalidraw-animate/) to play element ordering embedded in the source IDs. A preview is not claimed where no deterministic export was available.
`],
];
architecturePages.forEach(([slug, title, description, body], index) =>
  add(`architecture/${slug}`, {
    title, description, section: "architecture", order: sectionOrder.architecture + index,
    truthState: ["overview", "deployment"].includes(slug) ? "current" : "target",
    sourceFiles: architectureSources,
    relatedAdrs: ["0003-record-architecture-evolution-and-source-atlas", "0007-use-central-broker", "0008-stable-roles-dynamic-models", "0014-use-provider-adapter-boundary"],
    relatedPages: ["plans/capability-map", "references/source-map"], tags: ["architecture", "broker"],
  }, body),
);

const agents = [
  {
    slug: "chief-of-staff", name: "Chief of Staff", lane: "Leadership and intake",
    responsibility: "Clarify the request, select the business workflow, verify handoffs, and stop at approval gates.",
    when: "At the start of every multi-step business or software request.",
    inputs: ["Owner request", "Company policy", "Current portfolio and gate status"],
    output: "intake-routing.md with routing and gate status",
    tools: "Read, Glob, Grep; read-only",
    prohibited: ["specialist deliverables", "production code", "architecture authorship", "self-approval"],
    evidence: "Request wording, applicable policy, current gate state",
    criteria: "Route is justified; missing approvals and blockers are explicit",
    next: "Program Manager, Market Researcher, or Business Analyst",
    defect: "Chief of Staff",
    approval: "Human go/no-go when the request creates material commitment",
  },
  {
    slug: "program-manager", name: "Program Manager", lane: "Leadership and delivery coordination",
    responsibility: "Create milestones, dependencies, ownership, risk logs, and reviewable work units.",
    when: "After approved intake and throughout delivery coordination.",
    inputs: ["Approved intake", "Business objective", "Known constraints"],
    output: "program-plan.md, risk-register.md, and work-units/*.json",
    tools: "Read, Glob, Grep; controlled document write",
    prohibited: ["product requirements", "architecture choices", "implementation code", "release approval"],
    evidence: "Complete work-unit contracts and dependency mapping",
    criteria: "Every unit has measurable acceptance criteria and an owner",
    next: "Market Researcher, Business Analyst, or broker queue",
    defect: "Program Manager",
    approval: "Human approval for material scope or priority change",
  },
  {
    slug: "market-researcher", name: "Market Researcher", lane: "Business discovery",
    responsibility: "Validate customer problems, demand, alternatives, competitors, and evidence gaps.",
    when: "Before meaningful investment in an unvalidated product or feature.",
    inputs: ["Problem statement", "Target-market assumptions", "Approved research boundary"],
    output: "market-validation.md and source-register.md",
    tools: "Read, Glob, Grep, approved web research",
    prohibited: ["invented market data", "final investment decision", "technical architecture"],
    evidence: "Traceable primary or clearly qualified sources",
    criteria: "Claims are sourced; uncertainty and contradictory evidence are explicit",
    next: "Business Strategist, Financial Analyst, or Business Analyst",
    defect: "Market Researcher",
    approval: "Human go/no-go before material investment",
  },
  {
    slug: "business-analyst", name: "Business Analyst", lane: "Business discovery",
    responsibility: "Convert approved business needs into complete, testable requirements without designing the solution.",
    when: "Before product scope, experience design, architecture, or implementation.",
    inputs: ["Approved business evidence", "Stakeholders and users", "Problem definition"],
    output: "approved-requirements.md and acceptance-criteria matrix",
    tools: "Read, Glob, Grep; read-only",
    prohibited: ["technical design", "roadmap priority", "code", "unmarked business rules"],
    evidence: "Source needs, rules, scenarios, and stakeholder decisions",
    criteria: "Scope, rules, functional and nonfunctional requirements are testable",
    next: "Product Manager",
    defect: "Business Analyst",
    approval: "Human requirements approval",
  },
  {
    slug: "product-manager", name: "Product Manager", lane: "Product and design",
    responsibility: "Define product value, MVP scope, priority, success metrics, and deferred work.",
    when: "After requirements and before experience design or architecture.",
    inputs: ["Approved requirements", "Business strategy", "Success constraints"],
    output: "product-brief.md, backlog.yaml, and success-metrics.md",
    tools: "Read, Glob, Grep; read-only",
    prohibited: ["implementation code", "low-level technical design", "self-approved scope"],
    evidence: "Requirements coverage and explicit prioritization rationale",
    criteria: "MVP, user stories, measures, and deferred scope are coherent",
    next: "UX/UI Designer or Solution Architect",
    defect: "Product Manager",
    approval: "Human approval for material scope",
  },
  {
    slug: "ux-ui-designer", name: "UX/UI Designer", lane: "Product and design",
    responsibility: "Define journeys, screens, interactions, states, accessibility, and responsive behavior.",
    when: "For user-facing behavior after scope is approved.",
    inputs: ["Product brief", "Users", "Requirements", "Brand rules"],
    output: "ux-specification.md and user-flows.excalidraw",
    tools: "Read-only repository access and approved design tools",
    prohibited: ["scope changes", "application implementation", "backend architecture"],
    evidence: "Flows, content hierarchy, error/empty states, and accessibility criteria",
    criteria: "Every key state and interaction is specified and reviewable",
    next: "Solution Architect",
    defect: "UX/UI Designer",
    approval: "Human approval for major user-flow change",
  },
  {
    slug: "solution-architect", name: "Solution Architect", lane: "Architecture and security",
    responsibility: "Design components, APIs, data flow, reliability, deployment, trade-offs, and implementation sequence.",
    when: "Before implementation or a material system change.",
    inputs: ["Requirements", "Product scope", "UX specification", "Codebase map"],
    output: "architecture-package.md, diagrams, and ADRs",
    tools: "Read, Glob, Grep; read-only planning",
    prohibited: ["production code", "invented requirements", "self-approved architecture"],
    evidence: "Repository constraints, diagrams, alternatives, failure modes, and decisions",
    criteria: "Boundaries, data flow, trade-offs, security handoff, and migration are clear",
    next: "Security Architect",
    defect: "Solution Architect",
    approval: "Human approval for material architecture",
  },
  {
    slug: "security-architect", name: "Security Architect", lane: "Architecture and security",
    responsibility: "Create threat scenarios, security controls, abuse cases, and security acceptance criteria.",
    when: "Before sensitive or material implementation.",
    inputs: ["Architecture", "Data flows", "Sensitive assets", "Business rules"],
    output: "threat-model.md and security-requirements.md",
    tools: "Read, Glob, Grep; read-only planning",
    prohibited: ["production code", "accepting unresolved high-risk threats", "final legal advice"],
    evidence: "Assets, trust boundaries, abuse cases, residual risks",
    criteria: "No unresolved high-risk design blocker; controls are testable",
    next: "Codebase Researcher or privacy specialist",
    defect: "Security Architect",
    approval: "Human/legal/privacy approval where exposure is material",
  },
  {
    slug: "codebase-researcher", name: "Codebase Researcher", lane: "Engineering",
    responsibility: "Trace current behavior, dependencies, conventions, and safe change points without editing.",
    when: "Immediately before modifying an existing system.",
    inputs: ["Approved architecture", "Target work unit", "Repository instructions"],
    output: "codebase-map.md and change-point evidence",
    tools: "Read, Glob, Grep, safe read-only shell",
    prohibited: ["file edits", "architecture redesign", "unsupported behavior claims"],
    evidence: "File paths, symbols, execution flow, commands, and dependencies",
    criteria: "Every behavior claim cites repository evidence and regression risk",
    next: "Code Writer",
    defect: "Codebase Researcher",
    approval: "None unless inspection crosses a protected boundary",
  },
  {
    slug: "code-writer", name: "Code Writer", lane: "Engineering",
    responsibility: "Implement the smallest approved change and add or update tests.",
    when: "Only after scope, criteria, architecture, and safe change points are defined.",
    inputs: ["Approved work unit", "Architecture", "Security criteria", "Codebase map"],
    output: "Source diff, tests, and implementation.json",
    tools: "Read, edit, write, and shell only in the assigned isolated worktree",
    prohibited: ["merge", "push", "deploy", "self-approval", "test weakening", "silent scope expansion"],
    evidence: "Changed files, test output, build output, limitations",
    criteria: "Smallest correct change; local deterministic validation passes",
    next: "QA Engineer",
    defect: "Code Writer",
    approval: "Human approval before protected or production-impacting action",
  },
  {
    slug: "qa-engineer", name: "QA Engineer", lane: "Quality",
    responsibility: "Independently test implementation against acceptance criteria and regression risk.",
    when: "After the implementation owner completes local validation.",
    inputs: ["Acceptance criteria", "Implementation diff", "Test environment"],
    output: "qa-report.md and test results",
    tools: "Read, Glob, Grep, test shell; no implementation edits",
    prohibited: ["silent fixes", "test weakening", "approving its own fixes"],
    evidence: "Commands, environment, acceptance, regression, negative and edge results",
    criteria: "Blockers are reproducible and every criterion has a decision",
    next: "Code Writer when defects exist; otherwise PR Reviewer",
    defect: "QA Engineer for test defects; Code Writer for implementation defects",
    approval: "No final release authority",
  },
  {
    slug: "pr-reviewer", name: "PR Reviewer", lane: "Quality",
    responsibility: "Review the final diff for correctness, security, maintainability, performance, and requirement coverage.",
    when: "After implementation and independent QA.",
    inputs: ["Final diff", "Requirements", "Architecture", "QA evidence"],
    output: "pr-review.md",
    tools: "Read, Glob, Grep, safe read-only commands",
    prohibited: ["source edits", "merge", "ignoring failed tests", "approval with blockers"],
    evidence: "File/line findings, test evidence, requirements coverage, residual risks",
    criteria: "Decision and findings are evidence-backed with severity",
    next: "Code Writer for changes; otherwise DevOps Engineer or Release Manager",
    defect: "Code Writer or the owner of the defective deliverable",
    approval: "Recommendation only; not merge or release authority",
  },
  {
    slug: "devops-engineer", name: "DevOps Engineer", lane: "Delivery",
    responsibility: "Prepare approved CI/CD, environment, migration, rollback, monitoring, and alert artifacts.",
    when: "After implementation and review when delivery configuration changes.",
    inputs: ["Approved implementation", "Operational requirements", "Environment constraints"],
    output: "delivery-plan.md and controlled pipeline/operations artifacts",
    tools: "Controlled read, write, and shell",
    prohibited: ["unapproved production deployment", "embedded secrets", "gate bypass", "unrelated application edits"],
    evidence: "Pipeline checks, environment requirements, rollback and monitoring validation",
    criteria: "Delivery is repeatable and no production action occurred",
    next: "Release Manager",
    defect: "DevOps Engineer",
    approval: "Human approval before production change",
  },
  {
    slug: "release-manager", name: "Release Manager", lane: "Delivery",
    responsibility: "Verify business, quality, security, operational, migration, documentation, and rollback readiness.",
    when: "Immediately before a release decision.",
    inputs: ["All business, QA, review, security, and delivery evidence"],
    output: "release-readiness.md and post-release validation plan",
    tools: "Read-only and safe evidence commands",
    prohibited: ["merge", "deploy", "blocker waiver", "approval of incomplete evidence"],
    evidence: "Gate checklist, known issues, risks, approvals, rollback plan",
    criteria: "Release/hold recommendation is traceable and all required gates are represented",
    next: "Authorized human approver or Operations",
    defect: "Owning specialist role",
    approval: "Authorized human is final release authority",
  },
];

add("agents/overview", {
  title: "Agent organization", description: "Stable roles, dynamic providers, one deliverable owner, and independent review.",
  section: "agents", order: sectionOrder.agents, truthState: "target",
  sourceFiles: architectureSources, relatedAdrs: ["0008-stable-roles-dynamic-models", "0009-require-independent-second-voice"],
  relatedPages: ["agents/universal-agent-contract", "workflows/end-to-end-business-workflow"], tags: ["agents", "roles"],
}, `
## Core organization

The controlled company uses 14 core roles across leadership, business, product, architecture, engineering, quality, and delivery. One person or model can fill several roles across different work units, but one role owns each deliverable and the authoring session cannot approve it.

${agents.map((agent) => `{% agent_card role="${agent.name}" lane="${agent.lane}" href="/docs/agents/${agent.slug}/" %}\n${agent.responsibility}\n{% /agent_card %}`).join("\n\n")}

## Add roles only when needed

Growth and advanced operations roles are blueprints. Add a persistent agent only when recurring work, permission isolation, and measurable handoffs justify the complexity.
`);

add("agents/universal-agent-contract", {
  title: "Universal agent contract", description: "The minimum input, responsibility, permission, output, evidence, and stop contract for every role.",
  section: "agents", order: sectionOrder.agents + 1, truthState: "decision",
  sourceFiles: coreSources, relatedAdrs: ["0008-stable-roles-dynamic-models"], relatedPages: ["agents/universal-handoff"], tags: ["agents", "contract"],
}, `
## Contract

Every agent definition states:

- one responsibility and its neighboring-role boundaries;
- required approved inputs;
- one fixed deliverable;
- minimum tools and write level;
- prohibited actions;
- evidence and acceptance criteria;
- stop condition and blocker behavior;
- independent second-voice rule;
- human approval gate;
- defect return target and next role.

Read-only is the default. Implementation write permission is limited to an isolated worktree in the target architecture. The current simulation grants no repository write action to a provider.
`);

add("agents/universal-handoff", {
  title: "Universal handoff", description: "The fixed provider-neutral record that lets the next role continue without reinterpretation.",
  section: "agents", order: sectionOrder.agents + 2, truthState: "decision",
  sourceFiles: coreSources, relatedAdrs: ["0008-stable-roles-dynamic-models", "0014-use-provider-adapter-boundary"], relatedPages: ["architecture/work-unit-contract"], tags: ["agents", "handoff"],
}, `
## Required fields

\`\`\`text
Task completed
Inputs reviewed
Decisions made
Deliverables produced
Files affected
Assumptions
Risks
Open questions
Acceptance criteria status
Recommended next agent
Human approval required
\`\`\`

The broker extension adds work-unit ID, provider/model, role, session/run ID, worktree, commands, token usage when reported, gate results, review verdict, retry count, and artifact hashes.

Do not transfer a full transcript when approved documents, a diff, command evidence, and this handoff can carry the state more precisely.
`);

agents.forEach((agent, index) => add(`agents/${agent.slug}`, {
  title: agent.name, description: agent.responsibility,
  section: "agents", order: sectionOrder.agents + 10 + index, truthState: "target",
  sourceFiles: [
    "reference/source-materials/originals/Claude_Multi_Agent_Business_Guide.pdf",
    "reference/source-materials/originals/individual_agent_architecture_animated.excalidraw",
    "reference/source-materials/originals/unified_agent_operating_architecture_all_in_one.excalidraw",
  ],
  relatedAdrs: ["0008-stable-roles-dynamic-models", "0009-require-independent-second-voice"],
  relatedPages: ["agents/universal-agent-contract", "agents/universal-handoff"], tags: ["agent", agent.lane.toLowerCase()],
}, `
## Purpose

${agent.responsibility}

## Business department or lane

${agent.lane}.

## Single responsibility

${agent.responsibility}

## When to use

${agent.when}

## Approved inputs

${agent.inputs.map((input) => `- ${input}`).join("\n")}

## Required output or document

${agent.output}.

## Allowed tools

${agent.tools}.

## Prohibited actions

${agent.prohibited.map((item) => `- No ${item}.`).join("\n")}

## Write-access level

${agent.tools.toLowerCase().includes("write") || agent.tools.toLowerCase().includes("edit") ? "Only the explicitly controlled document or isolated worktree boundary stated above." : "Read-only."}

## Required evidence

${agent.evidence}.

## Acceptance criteria

${agent.criteria}.

## Stop condition

Stop when the required output is complete and the universal handoff is ready, or immediately when an unresolved blocker or required approval prevents safe continuation.

## Second-voice review

A fresh session from another eligible provider checks evidence, boundaries, and criteria without editing this deliverable. The authoring session does not count as an independent reviewer.

## Human approval rule

${agent.approval}.

## Defect return target

${agent.defect}. Reviewers do not silently repair the work they judge.

## Recommended next agent

${agent.next}.

## Failure and escalation behavior

Name the failed criterion, attach evidence, preserve the current state, and return the defect to its owning role. Stop when retry limits are reached or authority is missing.

## Example universal handoff

\`\`\`text
Task completed: ${agent.output}
Inputs reviewed: ${agent.inputs.join("; ")}
Decisions made: role-bounded decisions only
Deliverables produced: ${agent.output}
Files affected: listed with the artifact
Assumptions: explicit and reversible
Risks: residual risks recorded
Open questions: none, or blocker stated
Acceptance criteria status: pass / fail with evidence
Recommended next agent: ${agent.next}
Human approval required: ${agent.approval}
\`\`\`
`));

add("agents/business-growth-agents", {
  title: "Business growth agent blueprints", description: "Optional strategy, finance, marketing, sales, content, and customer roles.",
  section: "agents", order: sectionOrder.agents + 30, truthState: "proposal",
  sourceFiles: ["reference/source-materials/originals/Claude_Multi_Agent_Business_Guide.pdf"],
  relatedAdrs: ["0008-stable-roles-dynamic-models"], relatedPages: ["agents/universal-agent-contract"], tags: ["agents", "growth"],
}, `
## Optional roles

| Role | Responsibility | Output and handoff |
|---|---|---|
| Business Strategist | Business model, positioning, build/buy/partner fit | Strategy memo to Finance or human go/no-go |
| Financial Analyst | Budget, cash flow, unit economics, scenarios | Financial model to human investment approval |
| Marketing Strategist | Audience, message, channels, measures | Strategy to Content Creator |
| Content Creator | Approved marketing and education material | Publish-ready package to human editor |
| Sales Strategist | Qualification, discovery, proposal, objections | Sales playbook; human owns commitments |
| Customer Onboarding | Setup, training, milestones, handoff | Onboarding plan to Customer Success |
| Customer Support | Classify issues and use verified knowledge | Resolution or specialist escalation |
| Customer Success | Adoption, outcomes, renewal risk | Health review to Product or Sales |

These are not active services. Apply the universal agent contract before adding one.
`);

add("agents/advanced-operations-agents", {
  title: "Advanced operations agent blueprints", description: "Optional compliance, reliability, incident, knowledge, cost, and vendor roles.",
  section: "agents", order: sectionOrder.agents + 31, truthState: "proposal",
  sourceFiles: ["reference/source-materials/originals/Claude_Multi_Agent_Business_Guide.pdf"],
  relatedAdrs: ["0008-stable-roles-dynamic-models"], relatedPages: ["operations/operating-model"], tags: ["agents", "operations"],
}, `
## Optional roles

| Role | Responsibility |
|---|---|
| Privacy/Compliance | Data, retention, consent, deletion, geography, accessibility |
| Legal Risk Reviewer | Organize issues for qualified counsel |
| Operations Manager | SOPs, controls, escalation, metrics |
| Data/BI Analyst | Governed measures, dashboards, limitations |
| Knowledge Manager | Current source of truth and superseded records |
| AI Cost Controller | Usage, workflow cost, duplication, budget recommendations |
| Security Reviewer | Independent final security findings |
| Site Reliability Engineer | Service objectives, capacity, backup, recovery |
| Incident Commander | Detection, containment, recovery, communication |
| Technical Writer | Verified user, operator, API, architecture, and release docs |
| Vendor/Procurement | Cost, security, contracts, renewal, replacement risk |

Professional, legal, financial, privacy, and security authority remains human.
`);

const workflowPages = [
  ["overview", "Workflow overview", "Sequential role ownership, provider routing, deterministic gates, repair, and human authority.", `
## Default operating shape

Intake produces an approved request. Business and product roles define the outcome. Architecture and security define safe boundaries. Repository research locates change points. Implementation happens in one bounded workspace. QA and review are independent. Deterministic gates run before model voting. Release stops at authorized human authority.

The current code simulates this shape; it does not execute provider sessions or production actions.
`],
  ["end-to-end-business-workflow", "End-to-end business workflow", "The 15 controlled phases from idea intake through operations learning.", `
${[
  ["Idea intake", "Chief of Staff"],
  ["Market validation", "Market Researcher"],
  ["Business feasibility", "Business Strategist and Finance"],
  ["Requirements", "Business Analyst"],
  ["Product scope", "Product Manager"],
  ["Experience design", "UX/UI Designer"],
  ["Solution architecture", "Solution Architect"],
  ["Security design", "Security Architect"],
  ["Codebase research", "Codebase Researcher"],
  ["Implementation", "Code Writer"],
  ["QA and real commands", "QA Engineer"],
  ["Review panel", "Fresh reviewers"],
  ["Delivery preparation", "DevOps Engineer"],
  ["Release decision", "Release Manager and human"],
  ["Operations and learning", "Operations roles"],
].map(([title, owner], i) => `{% workflow_step number=${i + 1} title="${title}" owner="${owner}" %}\nOne approved deliverable and universal handoff controls entry to the next stage.\n{% /workflow_step %}`).join("\n\n")}
`],
  ["broker-work-unit-lifecycle", "Broker work-unit lifecycle", "Draft, context, approval, routing, execution, review, repair, and completion states.", `
\`\`\`text
draft
→ waiting-for-context
→ ready or waiting-for-user/approval
→ routed
→ executing
→ deterministic gates
→ independent review
→ repair or completion
→ documentation-impact proposal
\`\`\`

Workers cannot set \`complete\`. The broker may do so only after policy, evidence, criteria, blockers, and approvals satisfy the completion rule.

{% mermaid_diagram src="/diagrams/mermaid/work-unit-sequence.mmd" title="Work-unit sequence and provider handoff" /%}
`],
  ["planning-and-second-voice", "Planning and second voice", "A primary planner owns the plan and the other provider independently challenges it.", `
The broker selects the best eligible planner. The other provider receives the same approved goal, criteria, Markdoc context, ADR constraints, and evidence rules. It critiques assumptions, dependencies, risk, and testability without editing the plan.

Disagreement returns to the planning owner or a human gate; it does not create silent hybrid ownership.
`],
  ["implementation-and-diff-review", "Implementation and diff review", "Smallest-change implementation followed by a read-only review from the other provider.", `
The implementer receives write access only inside its assigned isolated worktree in the target architecture. It adds tests and reports local validation. The other provider then reviews the complete diff read-only.

The current prototype compiles prompts and simulates this state; it does not create a worktree or change files through a provider adapter.
`],
  ["quality-gates", "Deterministic quality gates", "Real commands and acceptance evidence remain authoritative over model confidence.", `
Required gates are selected from the repository’s actual format, lint, typecheck, unit, integration, build, and approved security commands. A failed blocking gate cannot be overruled by a reviewer vote.

Gate evidence includes the command, exit status, relevant output, environment, and criterion it supports.
`],
  ["majority-convergence", "Majority convergence", "The 2-of-3 panel policy with independence, blockers, evidence, and human gates.", `
## Completion rule

\`\`\`text
COMPLETE only when:
  deterministic gates pass
  AND at least 2 of 3 independent votes approve
  AND unresolved blockers = 0
  AND every criterion has evidence
  AND required human approvals are recorded
\`\`\`

The three panel roles are a fresh Claude reviewer, fresh Codex reviewer, and a fresh broker-selected arbiter. A session that authored the work is excluded.
`],
  ["bounded-repair-loop", "Bounded repair loop", "How evidence returns a defect to the role that owns it.", `
Requirement ambiguity returns to Business Analyst or Product Manager. Architecture defects return to Solution or Security Architect. Implementation defects return to Code Writer. Test defects return to QA. Delivery defects return to DevOps.

Retries are capped by workflow policy. Reaching the cap stops execution and escalates to a human; it never creates an infinite loop.
`],
  ["human-approval-flow", "Human approval flow", "How consequential actions pause until an authorized person decides.", `
{% human_gate kind="material decisions" %}
Architecture, spending, legal/privacy exposure, production changes, merge, deployment, and release require recorded human authority.
{% /human_gate %}

An approval record names the work unit, kind, scope, requester, status, decision time, authorized person, and rationale. Provider sessions cannot approve themselves.
`],
  ["release-flow", "Release flow", "Evidence assembly, hold/release recommendation, human decision, and post-release validation.", `
The Release Manager assembles requirements, gates, QA, reviews, security, delivery, rollback, documentation, and approvals. It recommends release, conditional release, or hold.

The broker never silently merges or deploys. The current implementation performs no GitHub or production action.
`],
  ["operations-learning-loop", "Operations and learning loop", "How support, reliability, customer outcomes, quality, and cost become new controlled work.", `
Operational evidence feeds Product and Program Management:

\`\`\`text
monitor → support → measure → learn → propose work unit → approve → route
\`\`\`

Learning records facts and uncertainty. It does not let runtime telemetry rewrite accepted Markdoc without a reviewed repository change.
`],
];
workflowPages.forEach(([slug, title, description, body], index) =>
  add(`workflows/${slug}`, {
    title, description, section: "workflows", order: sectionOrder.workflows + index,
    truthState: "target", sourceFiles: coreSources,
    relatedAdrs: ["0009-require-independent-second-voice", "0010-use-deterministic-quality-gates", "0012-require-human-approval"],
    relatedPages: ["agents/overview", "architecture/broker-control-plane"], tags: ["workflow"],
  }, body),
);

const governancePages = [
  ["permissions-and-least-privilege", "Permissions and least privilege", "Read-only defaults, controlled write boundaries, and forbidden external actions.", `
Planning and review are read-only. Future implementation write access is limited to one isolated worktree. Workers cannot push, merge, deploy, change remotes, use production credentials, or recursively create uncontrolled workers.

The broker applies policy before provider preference or scoring.
`],
  ["model-independence", "Model independence", "Why roles and business meaning stay stable when Claude or Codex changes.", `
Provider adapters receive the same work request, criteria, context, permissions, evidence rules, and stop conditions. They may format instructions for the target tool but cannot change business meaning.

Claude-first is configuration, not organizational identity. Codex may plan; Claude may implement; the broker selects per work unit.
`],
  ["capacity-and-cost-routing", "Capacity and cost routing", "Observed health, cooldown, load, quality, and manual capacity without fabricated allowances.", `
The capacity state records health, cooldown, manual capacity from 0 to 1, recent failures, active units, context pressure, and last success. Rate limits create a cooldown and fallback.

Consumer CLI plans do not expose one reliable universal API for exact tokens remaining. The UI must say “manual capacity” or “observed pressure,” never an invented allowance.
`],
  ["privacy-and-data-classification", "Privacy and data classification", "Public, internal, confidential, and restricted request handling.", `
Every request is classified before routing. A provider must support the classification and required tools. Restricted data is not eligible for either simulated provider profile by default.

Do not place secrets, credentials, private client data, or unnecessary personal information in Markdoc or a provider context package.
`],
  ["evidence-policy", "Evidence policy", "What must be cited before a decision, review, gate, or completion claim is valid.", `
Evidence can be a source file, decision, command, test, diff, artifact hash, approval, or qualified external source. It must be relevant to an acceptance criterion and record limitations.

Unsupported model confidence is not evidence. A deterministic failure is blocking.
`],
  ["audit-policy", "Audit policy", "The minimum event trail for translation, routing, execution, review, approval, and impact.", `
Audit records preserve interpretation, retrieved sources, routing scores, provider changes, sessions, commands, gate evidence, reviews, repairs, approvals, outcome, and documentation impact.

Current records exist only in memory during simulation. A durable store requires retention, access, deletion, backup, and recovery decisions.
`],
  ["human-authority", "Human authority", "Decisions the owner, authorized professionals, and clients retain.", `
The founder owns sales, pricing exceptions, scope approval, spending, credentials, external commitments, merge, deployment, and release. Qualified humans own legal, privacy, financial, and professional decisions. The client approves drafted client content before publication.

Automation prepares evidence and recommendations; it does not inherit authority from confidence.
`],
];
governancePages.forEach(([slug, title, description, body], index) =>
  add(`governance/${slug}`, {
    title, description, section: "governance", order: sectionOrder.governance + index,
    truthState: "decision", sourceFiles: coreSources,
    relatedAdrs: ["0008-stable-roles-dynamic-models", "0009-require-independent-second-voice", "0012-require-human-approval", "0014-use-provider-adapter-boundary"],
    relatedPages: ["architecture/security-boundaries"], tags: ["governance"],
  }, body),
);

const adrs = [
  {
    slug: "0001-why-beacon-exists-and-business-definition",
    number: "ADR-0001", title: "Why Beacon exists and the business definition", status: "approved", truth: "decision",
    context: "Strong local businesses can be difficult to find online, and a solo operator needs a bounded, credible entry rather than a speculative platform.",
    drivers: ["Useful local outcome", "Transparent small first engagement", "Founder and client authority", "Manual learning before automation"],
    options: ["Build a broad agency first", "Build an automation platform first", "Start with one local presence and a product ladder"],
    decision: "Operate Beacon & Co. as a solo digital-presence service around Waynesboro. Begin with a free audit and the smallest fitting paid service. Preserve the founder sales call and client content approval.",
    positive: ["Starts from a real customer problem", "Constrains architecture to current value", "Makes ownership and pricing legible"],
    negative: ["Founder remains a bottleneck", "Pricing and economics require operating evidence"],
    risks: ["Brand/name clearance remains open", "Market and margin claims may age", "Low pricing may not support actual time"],
    follow: ["Measure time and costs by offer", "Complete formal name/domain diligence", "Revalidate claims before public use"],
    supersedes: "Consolidates the prior founding/business records; superseded by: none.",
    sources: ["docs/decisions/0001-why-beacon-exists-and-business-definition.md", "docs/business/plan.md", "src/components/PricingCards.astro"],
  },
  {
    slug: "0002-define-brand-and-customer-experience",
    number: "ADR-0002", title: "Define the brand and customer experience", status: "approved", truth: "decision",
    context: "Beacon must earn local trust without loud agency claims or an impersonal software aesthetic.",
    drivers: ["Plain-language trust", "One clear next action", "Accessibility", "Real local proof", "Consistent brand"],
    options: ["Generic software theme", "High-stimulation agency design", "Restrained editorial Beacon system"],
    decision: "Use the forest, sage, gold, cream, ink, and rule palette; Playfair and DM Sans hierarchy; one primary CTA; real photography; visible focus; reduced motion; and honest status language.",
    positive: ["Consistent experience", "Clear review rules", "Accessibility is a requirement"],
    negative: ["Harder prioritization", "Real photography requires coordination"],
    risks: ["Decorative additions can dilute CTA hierarchy", "Color contrast can drift"],
    follow: ["Review desktop/mobile/keyboard/reduced motion", "Use canonical CSS tokens"],
    supersedes: "Consolidates earlier UI and brand choices; superseded by: none.",
    sources: ["docs/decisions/0002-define-brand-and-customer-experience.md", "docs/brand.md", "docs/product/experience-specification.md"],
  },
  {
    slug: "0003-record-architecture-evolution-and-source-atlas",
    number: "ADR-0003", title: "Record architecture evolution and source atlas", status: "approved", truth: "decision",
    context: "Beacon grew from one page to a maintainable site and then a documented target platform. Diagrams must not turn future systems into fictional current state.",
    drivers: ["Phase truth", "Smallest safe current architecture", "Editable sources", "Accessible alternatives"],
    options: ["One undifferentiated target diagram", "No architecture record", "Phase-gated narrative plus Mermaid/Excalidraw"],
    decision: "Keep current and target boundaries explicit. Maintain decision narrative, text diagrams, editable Excalidraw sources, previews, and textual alternatives.",
    positive: ["Proposal and production remain distinct", "Sources stay reviewable"],
    negative: ["Multiple overlapping diagrams require maintenance"],
    risks: ["A source preview may be mistaken for implementation"],
    follow: ["Update the catalog with every material architecture change", "Revalidate vendor choices at phase entry"],
    supersedes: "Consolidates prior architecture records; superseded by: none.",
    sources: ["docs/decisions/0003-record-architecture-evolution-and-source-atlas.md", ...architectureSources],
  },
  {
    slug: "0004-use-a-durable-ai-assisted-operating-model",
    number: "ADR-0004", title: "Use a durable AI-assisted operating model", status: "superseded", truth: "decision",
    context: "Claude and Codex sessions can end or hit capacity, so repository memory must outlive either tool.",
    drivers: ["Cross-provider continuity", "Lower repeated context", "Deterministic verification"],
    options: ["Chat-only memory", "File handoff only", "Immediate autonomous broker"],
    decision: "Originally adopted a file-only handoff and deferred a broker during Phase 1.",
    positive: ["Established repository-first memory", "Reduced transcript transfer"],
    negative: ["No typed routing or context package"],
    risks: ["The no-broker clause became inconsistent with the later explicit execution mandate"],
    follow: ["Retain compact handoffs", "Use ADR-0007 for the approved in-repository simulation boundary"],
    supersedes: "Superseded in part by ADR-0007. Repository-first memory remains valid.",
    sources: ["docs/decisions/0004-use-a-durable-ai-assisted-operating-model.md", "docs/ai-agent-workflow.md"],
  },
  {
    slug: "0005-use-astro-for-the-unified-site",
    number: "ADR-0005", title: "Use Astro for the unified marketing, docs, and workspace site", status: "approved", truth: "decision",
    context: "The repository already uses Astro static output and must not be replaced with a generic docs starter.",
    drivers: ["Preserve current app", "Static Cloudflare compatibility", "No client framework runtime", "One build"],
    options: ["Separate docs repository", "Replace marketing app", "Add docs/workspace routes to Astro"],
    decision: "Keep one Astro static application with marketing at /, documentation at /docs, and simulation at /workspace.",
    positive: ["One dependency graph and build", "Existing features remain intact"],
    negative: ["Docs styles and navigation require custom maintenance"],
    risks: ["A docs dependency could affect the marketing build"],
    follow: ["Keep docs CSS scoped by class", "Run the full Astro build"],
    supersedes: "New decision; superseded by: none.",
    sources: ["package.json", "astro.config.mjs", "BEACON_COMPLETE_EXECUTION_PROMPT.md"],
  },
  {
    slug: "0006-use-markdoc",
    number: "ADR-0006", title: "Use Markdoc as canonical documentation source", status: "approved", truth: "decision",
    context: "Project memory needs typed metadata, reusable components, source control, and retrieval by the orchestration module.",
    drivers: ["Content validation", "Astro integration", "Controlled components", "Repository retrieval"],
    options: ["Retain MkDocs as canonical", "Plain Markdown pages", "Astro content collection with Markdoc"],
    decision: "Use .mdoc content entries, a strict Astro collection schema, controlled tags, and unsafe HTML disabled.",
    positive: ["Typed source of truth", "Reusable readable components", "Same static build"],
    negative: ["Migration retains a temporary legacy docs tree"],
    risks: ["Two docs sources may confuse contributors during transition"],
    follow: ["Label Markdoc canonical in all entry points", "Remove legacy MkDocs only in a separately approved cleanup"],
    supersedes: "Supersedes MkDocs as canonical authoring system; legacy evidence is retained.",
    sources: ["BEACON_COMPLETE_EXECUTION_PROMPT.md", "src/content.config.ts", "markdoc.config.mjs"],
  },
  {
    slug: "0007-use-central-broker",
    number: "ADR-0007", title: "Use a central broker boundary", status: "approved", truth: "decision",
    context: "Provider switching, policy, evidence, and completion cannot safely live inside ad hoc prompts or Astro pages.",
    drivers: ["Provider neutrality", "Policy enforcement", "Continuation", "Auditability", "No self-completion"],
    options: ["Direct page-to-provider calls", "Prompt-only routing", "Separate internal orchestration module"],
    decision: "Implement a separate in-repository broker module as an in-memory simulation. Durable service extraction and live invocation remain future decisions.",
    positive: ["Explicit testable boundaries", "Pages do not own routing policy"],
    negative: ["Simulation is not operational automation"],
    risks: ["Users may mistake prompt previews for live work"],
    follow: ["Keep simulated labels visible", "Require a new ADR before a live or external broker"],
    supersedes: "Supersedes ADR-0004’s blanket no-broker clause while preserving file-based continuity.",
    sources: ["BEACON_COMPLETE_EXECUTION_PROMPT.md", "src/modules/orchestration/broker/broker.ts"],
  },
  {
    slug: "0008-stable-roles-dynamic-models",
    number: "ADR-0008", title: "Keep roles stable and assign models dynamically", status: "approved", truth: "decision",
    context: "Claude and Codex can perform overlapping work, while company responsibility must remain clear.",
    drivers: ["One deliverable owner", "Provider replacement", "Capacity fallback", "Measured affinity"],
    options: ["Claude architecture/Codex coding permanently", "Unstructured free-for-all", "Stable roles with broker assignment"],
    decision: "Define role contracts independently of providers. Assign Claude or Codex per work unit using policy, capability, preference, health, capacity, context, and affinity.",
    positive: ["No permanent model department", "Fallback preserves business meaning"],
    negative: ["Routing policy needs evidence and tuning"],
    risks: ["Affinity may harden into unsupported stereotype"],
    follow: ["Measure quality by task category", "Keep Claude-first configurable"],
    supersedes: "New decision; superseded by: none.",
    sources: coreSources,
  },
  {
    slug: "0009-require-independent-second-voice",
    number: "ADR-0009", title: "Require an independent second voice", status: "approved", truth: "decision",
    context: "An authoring model or session has correlated blind spots and cannot independently approve itself.",
    drivers: ["Reviewer independence", "Defect discovery", "Evidence-based convergence"],
    options: ["Self-review", "Same provider/session review", "Other provider plus fresh-session panel"],
    decision: "Use the other eligible provider for critique and exclude the authoring session from approval votes.",
    positive: ["Reduces correlated review", "Makes ownership explicit"],
    negative: ["Adds latency and provider usage"],
    risks: ["Ritual duplicate review can waste tokens on low-risk work"],
    follow: ["Scale review to risk", "Track whether second voice finds material defects"],
    supersedes: "New decision; superseded by: none.",
    sources: coreSources,
  },
  {
    slug: "0010-use-deterministic-quality-gates",
    number: "ADR-0010", title: "Use deterministic quality gates before model judgment", status: "approved", truth: "decision",
    context: "Confident review cannot prove that code builds, tests pass, or security checks succeed.",
    drivers: ["Reproducibility", "Blocking failures", "Acceptance evidence"],
    options: ["Model-only approval", "Optional commands", "Mandatory applicable commands before voting"],
    decision: "Run real applicable repository commands before review convergence. A failed blocking gate cannot be outvoted.",
    positive: ["Objective completion evidence", "Prevents confidence-based overrides"],
    negative: ["Commands require maintenance and can be slow"],
    risks: ["A narrow suite can still miss behavior"],
    follow: ["Add tests with each behavior", "Record command and environment"],
    supersedes: "New decision; superseded by: none.",
    sources: coreSources,
  },
  {
    slug: "0011-use-isolated-git-worktrees",
    number: "ADR-0011", title: "Use isolated Git worktrees for live implementation workers", status: "draft", truth: "proposal",
    context: "A live worker must not contaminate the primary working tree or another work unit.",
    drivers: ["Isolation", "Recoverability", "Parallel-safety prerequisite"],
    options: ["Primary worktree edits", "Temporary copies", "Broker-managed Git worktrees"],
    decision: "Proposed: when live execution is authorized, assign one validated worktree per work unit. No worktree executor exists now.",
    positive: ["Clear diff and cleanup boundary"],
    negative: ["Lifecycle and storage complexity"],
    risks: ["Stale worktrees, overlapping files, destructive cleanup"],
    follow: ["Threat-model commands", "Build a dry-run lifecycle", "Require explicit cleanup policy"],
    supersedes: "Draft proposal; superseded by: none.",
    sources: ["reference/source-materials/originals/Claude_Codex_Broker_Addendum.docx", "BEACON_COMPLETE_EXECUTION_PROMPT.md"],
  },
  {
    slug: "0012-require-human-approval",
    number: "ADR-0012", title: "Require human approval for high-impact actions", status: "approved", truth: "decision",
    context: "Models may organize evidence but do not own legal, financial, production, or business authority.",
    drivers: ["Accountability", "Safety", "Professional authority", "Client control"],
    options: ["Autonomous approval", "Approval only at release", "Risk-specific gates throughout"],
    decision: "Pause material architecture, spending, legal/privacy, production, merge, deployment, and release until an authorized human records a scoped decision.",
    positive: ["Authority stays accountable", "Stops irreversible ambiguity"],
    negative: ["Human availability can delay work"],
    risks: ["A vague approval may be over-applied"],
    follow: ["Record scope, person, time, and rationale", "Expire approvals when scope changes"],
    supersedes: "New decision; superseded by: none.",
    sources: coreSources,
  },
  {
    slug: "0013-use-docs-as-code",
    number: "ADR-0013", title: "Use docs as code for canonical project memory", status: "approved", truth: "decision",
    context: "Chat memory and runtime state are incomplete and provider-specific.",
    drivers: ["Version history", "Reviewability", "Cross-agent continuity", "Retrieval"],
    options: ["Chat transcripts", "Runtime database as truth", "Version-controlled Markdoc"],
    decision: "Store approved business, architecture, decisions, contracts, workflows, and runbooks in Markdoc. Propose all updates through repository review.",
    positive: ["Durable provider-neutral memory", "Lower repeated context"],
    negative: ["Requires maintenance discipline"],
    risks: ["Stale approved pages can misroute work"],
    follow: ["Track owner and review date", "Run conflict and link validation"],
    supersedes: "Extends ADR-0004 and ADR-0006; superseded by: none.",
    sources: ["BEACON_COMPLETE_EXECUTION_PROMPT.md", "src/content.config.ts"],
  },
  {
    slug: "0014-use-provider-adapter-boundary",
    number: "ADR-0014", title: "Use a provider adapter boundary", status: "approved", truth: "decision",
    context: "Claude and Codex need tool-specific formatting without changing the approved request.",
    drivers: ["Same business meaning", "Replaceability", "Fallback", "Testability"],
    options: ["Provider-specific requests", "Direct broker CLI logic", "Shared request with adapters"],
    decision: "Compile provider-specific prompts from the same work request and context package. Adapters cannot alter criteria, approvals, or business meaning.",
    positive: ["Safe provider switch", "Adapter behavior can be tested"],
    negative: ["Live invocation still needs provider-specific operational controls"],
    risks: ["A compiler could accidentally omit a constraint"],
    follow: ["Add parity tests", "Require a new security review before live credentials"],
    supersedes: "New decision; superseded by: none.",
    sources: ["BEACON_COMPLETE_EXECUTION_PROMPT.md", "src/modules/orchestration/providers/provider-adapter.ts"],
  },
];

add("decisions/index", {
  title: "Decision book", description: "Business, experience, architecture, documentation, orchestration, and governance decisions in dependency order.",
  section: "decisions", order: sectionOrder.decisions, truthState: "decision",
  sourceFiles: ["docs/decisions/index.md", "BEACON_COMPLETE_EXECUTION_PROMPT.md"],
  relatedAdrs: [], relatedPages: ["decisions/adr-template"], tags: ["adr", "decisions"],
}, `
## Foundation

The first decisions remain business definition, customer experience, and architecture evolution. Orchestration decisions depend on them; they do not replace them.

${adrs.map((adr) => `{% decision_card number="${adr.number}" status="${adr.status}" href="/docs/decisions/${adr.slug}/" %}\n### ${adr.title}\n\n${adr.decision}\n{% /decision_card %}`).join("\n\n")}

## Status rule

Implemented and established repository choices may be approved. Target architecture not implemented is draft or under review unless the decision governs a simulation or policy boundary that now exists. Evidence alone does not accept an ADR.
`);

add("decisions/adr-template", {
  title: "ADR template", description: "Required one-decision structure and truthful status guidance.",
  section: "decisions", order: sectionOrder.decisions + 1, truthState: "reference",
  sourceFiles: ["BEACON_COMPLETE_EXECUTION_PROMPT.md"], relatedAdrs: [], relatedPages: ["governance/evidence-policy"], tags: ["adr", "template"],
}, `
## Template

\`\`\`md
# ADR-NNNN — Decision title

Status:
Date:

## Context
## Decision drivers
## Options considered
## Decision
## Positive consequences
## Negative consequences
## Risks
## Follow-up work
## Supersedes / superseded by
## Source references
\`\`\`

Use one decision per record. Use approved only when repository behavior or an authorized governing decision supports it. Use draft when evidence is insufficient.
`);

adrs.forEach((adr, index) => add(`decisions/${adr.slug}`, {
  title: `${adr.number} — ${adr.title}`, description: adr.decision,
  section: "decisions", order: sectionOrder.decisions + 10 + index,
  status: adr.status, truthState: adr.truth, sourceFiles: adr.sources,
  relatedAdrs: [], relatedPages: ["decisions/index"], tags: ["adr", adr.status],
}, `
{% decision_card number="${adr.number}" status="${adr.status}" %}
One decision. Status reviewed ${reviewed}.
{% /decision_card %}

## Context

${adr.context}

## Decision drivers

${adr.drivers.map((item) => `- ${item}`).join("\n")}

## Options considered

${adr.options.map((item) => `- ${item}`).join("\n")}

## Decision

${adr.decision}

## Positive consequences

${adr.positive.map((item) => `- ${item}`).join("\n")}

## Negative consequences

${adr.negative.map((item) => `- ${item}`).join("\n")}

## Risks

${adr.risks.map((item) => `- ${item}`).join("\n")}

## Follow-up work

${adr.follow.map((item) => `- ${item}`).join("\n")}

## Supersedes or superseded by

${adr.supersedes}

## Source references

${adr.sources.map((source) => `- \`${source}\``).join("\n")}
`));

const operationsPages = [
  ["operating-model", "Operating model", "How the controlled company runs one role, one phase, and one evidence-backed handoff at a time.", `
Sequential execution is the default until isolation, ownership, and recovery are proven. The Chief of Staff selects the workflow; the broker enforces work-unit, provider, policy, gate, and completion state; specialists own deliverables; humans own consequential decisions.
`],
  ["configuration", "Configuration", "Claude-first preference, task affinity, provider profiles, workflow limits, and simulation settings.", `
Configuration currently lives in typed defaults. Claude-first is enabled for planning, architecture, and documentation. Codex is the code-affinity provider. Both profiles allow public, internal, and confidential simulated work but not restricted data.

Future external configuration must be validated, versioned, and must not contain secrets in Markdoc.
`],
  ["model-health-and-cooldowns", "Model health and cooldowns", "Observed failure, degradation, rate limits, manual capacity, and recovery.", `
Health states are healthy, degraded, rate-limited, and unavailable. Cooldown timestamps, recent failures, active work, context pressure, last success, and manual capacity affect eligibility and score.

A provider that is rate-limited, unavailable, cooling down, or at zero capacity is rejected before preference. Fallback preserves the same work request and context.
`],
  ["monitoring", "Monitoring", "Target signals for provider, workflow, quality, cost, and business outcomes.", `
Target monitoring includes routing decisions, queue age, provider health, cooldown, latency, reported token/cost, failure category, gate pass rate, repair count, review findings, approval time, accepted outcome, and documentation freshness.

No production monitoring stack exists for orchestration.
`],
  ["incident-response", "Incident response", "Target detection, containment, recovery, communication, and learning flow.", `
An Incident Commander coordinates the timeline, impact, containment, recovery, communication, and follow-up. Relevant engineering, security, SRE, product, and human owners remain accountable for their deliverables.

Production incidents cannot be simulated into a “resolved” state without evidence.
`],
  ["backup-and-recovery", "Backup and recovery", "Current repository recovery and future runtime-state requirements.", `
Git and source-controlled Markdoc preserve approved project memory. Imported source originals remain hashed and unchanged.

Future runtime storage requires backup frequency, restore testing, retention, encryption, access, deletion, and regional decisions before adoption.
`],
  ["release-runbook", "Release runbook", "Evidence and authority required before any future merge, deployment, or release.", `
1. verify approved scope and acceptance criteria;
2. run all applicable deterministic gates;
3. obtain independent QA, PR, and security decisions;
4. resolve blockers through the owning role;
5. verify documentation impact and rollback;
6. assemble the Release Manager recommendation;
7. record authorized human approval;
8. perform the separately authorized release action;
9. validate and record outcome.

The current orchestration prototype stops before steps 7–9 and performs no release action.
`],
];
operationsPages.forEach(([slug, title, description, body], index) =>
  add(`operations/${slug}`, {
    title, description, section: "operations", order: sectionOrder.operations + index,
    truthState: ["configuration", "model-health-and-cooldowns"].includes(slug) ? "current" : "target",
    sourceFiles: coreSources, relatedAdrs: ["0007-use-central-broker", "0010-use-deterministic-quality-gates", "0012-require-human-approval"],
    relatedPages: ["workflows/operations-learning-loop"], tags: ["operations"],
  }, body),
);

add("references/source-map", {
  title: "Source map", description: "Authority, provenance, extraction, and conflict rules for project claims and diagrams.",
  section: "references", order: sectionOrder.references, truthState: "current",
  sourceFiles: [
    "reference/source-materials/inventory/source-inventory.json",
    "reference/source-materials/inventory/source-assessment.json",
    "BEACON_COMPLETE_EXECUTION_PROMPT.md",
  ],
  relatedAdrs: ["0003-record-architecture-evolution-and-source-atlas", "0013-use-docs-as-code"],
  relatedPages: ["references/open-questions", "architecture/diagrams"], tags: ["sources", "provenance"],
}, `
## Tier 1: authoritative organization and broker content

- \`Claude_Multi_Agent_Business_Guide.pdf\`
- \`Claude_Codex_Broker_Addendum.docx\`
- all supplied AI-company, individual-agent, unified, easy-read, and broker Excalidraw/ZIP sources

These define role contracts, workflow, broker target, routing, gates, approvals, audit, and diagram meaning.

## Tier 2: authoritative repository context

Current source, configuration, instructions, docs, scripts, tests, and deployment files define what exists and what constraints apply.

## Tier 3: visual reference only

\`v9-source.html\`, \`veslyn-proposal.html\`, and \`smart-home-architecture.html\` inform layout, navigation, responsive behavior, cards, tabs, and diagram presentation. Their unrelated domain claims are not broker or product truth.

## Safe import evidence

The importer discovered top-level Downloads files, copied them without deletion, hashed them, and recorded original and repository paths. PDFKit extracted the PDF; \`textutil\` extracted the DOCX; ZIPs were listed and extracted without mutation; JSON scenes were parsed; HTML structures were inspected.

See \`reference/source-materials/inventory/source-inventory.md\` and \`source-assessment.md\` for exact sizes, hashes, labels, headings, and extracted contents.

## Conflict rule

Current repository behavior controls current-state claims. Approved ADRs control governing direction. Tier 1 target sources remain target until implemented. Conflicts are stated and added to [Open questions](/docs/references/open-questions/).
`);

add("references/document-statuses", {
  title: "Document statuses", description: "Approved lifecycle and truth-state labels for canonical documentation.",
  section: "references", order: sectionOrder.references + 1, truthState: "reference",
  sourceFiles: ["BEACON_COMPLETE_EXECUTION_PROMPT.md"], relatedAdrs: ["0013-use-docs-as-code"], relatedPages: ["getting-started/documentation-guide"], tags: ["status"],
}, `
| Status | Meaning |
|---|---|
| Draft | Incomplete or insufficient evidence |
| Under review | Active review; not yet governing |
| Approved | Governing project knowledge |
| Superseded | Historical; replaced by a linked record |

| Truth state | Meaning |
|---|---|
| Current | Verified repository behavior |
| Decision | Accepted direction or rule |
| Target | Approved or described future architecture, not current |
| Proposal | Unaccepted or unimplemented option |
| Reference | Supporting explanation or provenance |
`);

add("references/glossary", {
  title: "Glossary", description: "Shared business, documentation, orchestration, provider, and evidence vocabulary.",
  section: "references", order: sectionOrder.references + 2, truthState: "reference",
  sourceFiles: coreSources, relatedAdrs: ["0008-stable-roles-dynamic-models"], relatedPages: ["product/terminology"], tags: ["glossary"],
}, `
## Business and product

**Beacon & Co.** Working company name. **Spark, Website, Presence, Authority.** The current offer ladder. **Free audit.** Primary marketing conversion.

## Orchestration

**Translator.** Converts ordinary language to a validated request. **Broker.** Enforces routing and completion. **Provider.** Claude or Codex. **Second voice.** Independent critique. **Continuation package.** Provider-neutral current state.

## Evidence

**Deterministic gate.** A real command or fixed check. **Blocker.** A condition that prevents safe completion. **Human gate.** Recorded authorization. **Documentation impact.** Required canonical update proposal.
`);

add("references/open-questions", {
  title: "Open questions and source conflicts", description: "Unresolved decisions, source tensions, and migration needs that must not be silently assumed.",
  section: "references", order: sectionOrder.references + 3, status: "under-review", truthState: "reference",
  sourceFiles: ["BEACON_COMPLETE_EXECUTION_PROMPT.md", "AGENTS.md", "docs/current-state.md", "docs/decisions/0004-use-a-durable-ai-assisted-operating-model.md"],
  relatedAdrs: ["0004-use-a-durable-ai-assisted-operating-model", "0007-use-central-broker", "0011-use-isolated-git-worktrees"],
  relatedPages: ["plans/future-work"], tags: ["questions", "conflicts"],
}, `
## Resolved for this implementation

- **MkDocs versus Markdoc:** Markdoc is now canonical; MkDocs is retained as migration evidence.
- **Phase 1 versus broker request:** only a typed in-memory simulation is authorized; no speculative backend was added.
- **ADR numbering:** founding ADRs 0001–0004 remain in order; new decisions continue at 0005.

## Still open

- When, if ever, should one provider adapter invoke a live CLI?
- What threat model and operator approval are required for worktree creation?
- What durable store fits audit, approvals, retention, and recovery?
- Which measured tasks justify a Claude or Codex affinity adjustment?
- When can the legacy MkDocs tree be removed?
- What formal name/domain/trademark decision replaces the provisional Beacon name?
- Which proposal market, competitor, pricing, margin, and vendor claims remain valid after revalidation?
`);

for (const page of pages) {
  const destination = join(contentRoot, page.path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, page.content);
}

console.log(`Generated ${pages.length} canonical Markdoc pages in src/content/docs.`);
