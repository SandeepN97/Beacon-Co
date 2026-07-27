# Beacon documentation and orchestration build plan

Date: 2026-07-27  
Status: Approved for implementation by the complete execution prompt  
Repository: `/Users/nishabhattarai/Beacon-Co`

## Outcome

Extend the existing Beacon & Co. Astro repository with two reviewable, separately bounded capabilities:

1. an Astro + Markdoc documentation application under `/docs` that becomes the canonical project memory; and
2. an in-repository orchestration prototype under `src/modules/orchestration/` that translates informal requests, retrieves approved documentation, recommends Claude or Codex, preserves continuation context, enforces approval and quality policies, and evaluates documentation impact.

The marketing site and its narrow contact Worker remain intact. The orchestration work is a typed, in-memory, simulated vertical slice. It does not add a database, durable queue, production provider calls, deployment automation, or an autonomous backend.

## Inspection completed before implementation

### Repository

- Astro `7.1.3`, static output, plain CSS, and component-scoped vanilla JavaScript.
- One implemented marketing page and one narrow Cloudflare Worker contact route.
- Current MkDocs handbook with four foundation ADRs, proposal evidence, Mermaid sources, Excalidraw sources, and validation scripts.
- `CLAUDE.md` is expected to remain the shared-instruction link to `AGENTS.md`.
- Existing working-tree changes are user work and will be preserved.
- No existing orchestration module or automated test suite.

Inspected: `package.json`, lockfile, `astro.config.mjs`, `tsconfig.json`, `wrangler.jsonc`, `README.md`, `AGENTS.md`, `CLAUDE.md`, `KICKOFF_PROMPT.md`, `SETUP.md`, current `src/`, `public/`, `docs/`, `reference/`, and documentation tooling.

### Safe source import

The expected 12 source files were found at the top level of `~/Downloads`, copied non-destructively into `reference/source-materials/originals/`, and hashed. The Downloads originals were not changed.

- Inventory: `reference/source-materials/inventory/source-inventory.json`
- Human-readable inventory: `reference/source-materials/inventory/source-inventory.md`
- Parsed assessment: `reference/source-materials/inventory/source-assessment.json`
- Human-readable assessment: `reference/source-materials/inventory/source-assessment.md`
- Importer: `scripts/import-reference-materials.mjs`
- Inspector: `scripts/inspect-source-materials.mjs`

The 41-page PDF was extracted with a repository-local Objective-C/PDFKit helper and read completely. The DOCX was extracted with macOS `textutil` and read completely. Both ZIP files were listed and extracted without changing their originals. Every supplied Excalidraw JSON scene and library was parsed, including text labels and animation metadata embedded in element IDs. The three HTML references were inspected for headings, navigation, components, CSS, responsive rules, reduced-motion behavior, diagrams, and scripts.

### Authority map

| Tier | Sources | Use |
|---|---|---|
| Tier 1 | Agent guide, broker addendum, four standalone Excalidraw scenes, two ZIP packages | Organization, role contracts, workflows, broker target, routing, gates, approvals, audit, and diagram meaning |
| Tier 2 | Current repository source, configuration, instructions, existing docs, tests, scripts, and deployment configuration | What is implemented now and what repository constraints apply |
| Tier 3 | `v9-source.html`, `veslyn-proposal.html`, `smart-home-architecture.html` | Visual hierarchy, responsive patterns, navigation, tabs/cards, diagram presentation, and interaction inspiration only |

Tier 3 domain claims will not be imported as authoritative broker or product facts. Existing Beacon business content remains governed by Tier 2 repository records. Where Tier 1 describes future infrastructure, pages will explicitly label it `proposed` or `simulated`, never implemented.

## Decisions made for this build

1. **One Astro application.** The marketing site remains at `/`; the canonical handbook lives under `/docs`; the simulated operator workspace lives under `/workspace`.
2. **Markdoc replaces MkDocs as the canonical authored documentation.** Existing MkDocs sources and tooling are retained as migration evidence for this work unit; they will not be deleted.
3. **Static-compatible workspace.** The orchestration example uses in-memory state and simulation. No server adapter, data service, database, queue, or live Claude/Codex credentials are added.
4. **Astro content collection.** Use `src/content.config.ts`, Astro’s `glob()` loader, a strict frontmatter schema, and `.mdoc` files.
5. **Safe Markdoc.** Keep `allowHTML` disabled and map reusable tags to controlled Astro components.
6. **Lightweight search.** Generate a small repository-owned client-side JSON index. Add no hosted search service.
7. **ADR numbering continuity.** Preserve current foundation ADRs 0001–0004 in meaning and migrate them into Markdoc. Add the ten execution-prompt decisions as ADRs 0005–0014 instead of overwriting the business, experience, architecture, and operating foundation.
8. **Provider neutrality.** Claude-first is configurable; policy eligibility comes first; Codex receives code affinity, fallback, explicit-request, and independent-review routes.
9. **No self-approval.** Reviewer selection must exclude the authoring provider/session, and failed deterministic gates or blockers cannot be outvoted.
10. **Documentation changes remain reviewable.** The impact analyzer returns update/ADR proposals; runtime state never rewrites Markdoc.

## Planned implementation

### 1. Configuration and dependencies

- Add official `@astrojs/markdoc`.
- Add Vitest for orchestration unit tests.
- Use `astro/zod` for schemas instead of a separate Zod dependency.
- Register Markdoc without enabling arbitrary HTML.
- Add `markdoc.config.mjs`, `markdoc.config.json`, and VS Code extension guidance.
- Add scripts for type checking, testing, documentation validation, search indexing, and source inspection.

### 2. Orchestration boundary

Create the complete requested directory boundary under `src/modules/orchestration/`:

- `domain/`: typed schemas and contracts;
- `translator/`: normalization, safe assumptions, clarification policy, acceptance criteria;
- `knowledge/`: Markdoc reader, index, retrieval, conflict detection, context package;
- `broker/`: routing policy, provider health/capacity, continuation, broker state;
- `providers/`: Claude and Codex adapters and prompt compilers;
- `workflows/`: registry, state machine, deterministic gates, bounded repair, completion policy;
- `approvals/`: policy, manager, in-memory store;
- `audit/`: typed events and in-memory evidence;
- `documentation/`: impact and ADR/update proposal generation.

The first complete slice will demonstrate:

```text
informal request
→ validated provider-neutral work request
→ relevant Markdoc/ADR context
→ routing recommendation
→ Claude or Codex prompt preview
→ simulated execution state
→ documentation-impact result
```

### 3. Documentation corpus

Create the requested `.mdoc` hierarchy for:

- getting started;
- product and scope;
- roadmap and capability phases;
- system, broker, worker, security, state, audit, and deployment architecture;
- the 14 core agent contracts plus growth and advanced roles;
- business and work-unit workflows;
- provider, permission, evidence, audit, privacy, capacity, and human governance;
- foundation and orchestration ADRs;
- operations and runbooks;
- source map, statuses, glossary, conflicts, and open questions.

Every page will have validated metadata, status, owner, review date, source files, related ADRs/pages, and explicit current/target/proposal distinctions. Individual agent pages will include every field in the required agent-page contract.

### 4. Documentation UI

- Responsive branded docs shell with high-contrast navigation.
- Mobile drawer, breadcrumbs, in-page table of contents, previous/next links.
- Status, owners, review date, source references, related ADRs/pages.
- Accessible tables, visible focus, print styling, reduced motion, and overflow controls.
- Code-copy affordances with the original code still usable without JavaScript.
- Controlled Markdoc components for callouts, decisions, evidence, human gates, status, source references, roles, workflows, work units, and architecture diagrams.
- `/workspace` interpretation preview composed from Astro components; routing policy remains in the orchestration module.

### 5. Diagrams

- Copy every supplied `.excalidraw` source into `public/diagrams/source/`.
- Preserve useful extracted ZIP contents in organized source/reference folders.
- Copy the two supplied preview PNGs into `public/diagrams/previews/`.
- Reuse truthful existing SVG/Mermaid assets where they describe current Beacon state.
- Attempt deterministic exports only with repository-safe available tooling.
- Link source-only diagrams to Excalidraw and Excalidraw Animate with clear instructions.
- Provide text alternatives and a catalog recording purpose, level, status, related pages, source filename, and static/animated availability.
- Never fabricate an export.

### 6. Tests and validators

Vitest coverage:

- vague request normalization;
- assumption disclosure;
- required clarification;
- Markdoc retrieval and conflict detection;
- Claude-first preference;
- Codex code affinity;
- both capacity fallback directions;
- user override and policy override;
- independent reviewer selection;
- continuation-package completeness;
- documentation-impact decisions;
- deterministic gate and completion constraints.

Repository validation:

```bash
npm run test
npm run typecheck
npm run docs:validate
npm run build
git diff --check
```

The documentation validator will check frontmatter, duplicate IDs/routes, navigation coverage, internal links, source references, diagram links, and search-index generation.

Browser checks will cover desktop, mobile, navigation/focus basics, overflow, reduced-motion fallbacks, docs rendering, diagram access, and the workspace simulation. Existing marketing output and the contact Worker build must remain intact.

## Risks and treatment

- **Existing ADR conflict:** ADR-0004 previously deferred a broker. This work implements only the explicitly authorized local simulation and will supersede the conflicting boundary with a truthful new ADR.
- **MkDocs/Markdoc overlap:** both source trees will exist during migration. All entry-point documentation will identify Markdoc as canonical and MkDocs as retained legacy evidence.
- **Large content surface:** use shared data/contracts and validation to prevent empty pages, missing agent fields, and navigation drift.
- **Diagram scale:** giant canvases are references, not the only explanation. Smaller textual/Mermaid views will accompany them.
- **No live providers:** adapters compile prompts and simulate outcomes only. The UI and report will label this limitation.
- **No exact subscription allowance:** capacity uses health, cooldown, observed failure, load, and manual override. It will never show fabricated tokens remaining.
- **Source tension:** conflicts will be recorded in `references/open-questions.mdoc`; repository behavior controls current-state claims and Tier 1 controls target architecture.

## Completion evidence

The final `docs-implementation-report.md` will list:

- every created and modified path;
- dependencies added;
- source files and extraction methods;
- documentation and diagrams produced;
- tests and builds with real results;
- simulated versus live behavior;
- unresolved blockers;
- the recommended next bounded work unit.

No deploy, merge, push, destructive source cleanup, production credential use, or write outside this repository is authorized.
