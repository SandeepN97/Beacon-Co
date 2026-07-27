# Beacon secure CI/CD build plan

Date: 2026-07-27
Status: Approved for repository implementation by the supplied execution package
Repository commit inspected: `6f732f99a14ed5b92c3ae55bebce6f9a339681c5`
Branch inspected: `agent/markdoc-orchestration-system`

## Objective

Implement the repository-controlled portion of the Beacon secure CI/CD target without deploying, merging, pushing, changing GitHub or Cloudflare settings, using production credentials, or claiming that external controls are active.

The supplied package is:

- `BEACON_SECURE_CICD_ARCHITECTURE_10_OF_10.excalidraw`
- `BEACON_SECURE_CICD_EXECUTION_PROMPT_10_OF_10.md`
- `BEACON_SECURE_CICD_IMPLEMENTATION_PLAN_10_OF_10.md`

The architecture is a target model. Repository code, tests, policies, and workflow definitions can be implemented now. GitHub rulesets, environments, reviewers, secrets, Cloudflare resources, deployment protection, and rate-limiting controls remain pending until a human configures and verifies them.

## Current state

### Application

- Astro 7.1.3 builds a static marketing site, Markdoc handbook, and local orchestration simulation.
- A Cloudflare Worker serves `dist/` and handles `POST /api/contact`.
- The contact route checks the exact allowed origin, parses form data, validates basic field lengths and email shape, verifies Turnstile server-side, and sends through Resend.
- The contact route currently lacks an explicit request-body limit, downstream timeouts, structured redacted events, best-effort duplicate suppression, an optional Cloudflare rate-limit binding, full enum validation, and consistent response security headers.
- Static responses do not currently receive a repository-defined browser security-header policy.

### Documentation and decisions

- `src/content/docs/` is the canonical Astro + Markdoc source of truth.
- The older `docs/` tree is migration evidence and is not canonical.
- ADR-0010 requires deterministic quality gates; ADR-0012 retains human authority for production, merge, deployment, and release.
- Existing security documentation describes target boundaries but does not provide the supplied threat model, secure-development standards, exceptions, vulnerability policy, deployment controls, or recovery procedures.

### Tests and local commands

- Present: Astro type checking, 19 orchestration unit tests, Markdoc validation, Mermaid parsing, and the production build.
- Absent: formatting command, lint command, contact-route tests, integration tests, browser accessibility tests, responsive/reflow tests, security-header tests, secret supplement, dependency/action policy checks, license checks, SBOM/digest generation, and built-site link validation.
- `npm audit` could not reach the npm advisory endpoint during inspection because the sandbox had no registry network access. No vulnerability conclusion is claimed.

### GitHub and Cloudflare

- `.github/` does not exist.
- The repository is public and user-owned.
- `main` is currently unprotected and no repository ruleset exists.
- PR #5 has one successful Cloudflare Workers build check but no repository CI check.
- Cloudflare is connected to GitHub. The dashboard must be inspected to verify whether non-production branches are isolated previews or share production configuration.
- Repository rulesets, public-repository environment protection, CodeQL, dependency review, and public-repository artifact attestations are available in the current GitHub product model, subject to dashboard enablement.
- Team-based required reviewers are unavailable in a user-owned repository because it has no organization teams.
- A pull-request author cannot supply an independent approval. With one human operator, a mandatory one- or two-person PR approval rule would deadlock normal work.
- Prevent-self-review for production cannot be satisfied until a second accountable human is granted access. Until then, production remains a documented manual hold rather than a claimed two-person control.

### AI and source handling

- `AGENTS.md` and the `CLAUDE.md` symlink provide one agent instruction source.
- The orchestration module is an in-memory simulation; it cannot merge, deploy, invoke providers, or persist approvals.
- Sensitive local files are ignored, but there is no CI enforcement for AI rule files, workflow files, provider adapters, approval policy, package scripts, or deployment configuration.
- The supplied package has been read from `~/Downloads` but has not yet been copied or modified.

## Exact gaps

1. No pull-request policy, ownership map, dependency automation, or CI workflows.
2. No immutable Action allow-list or automated workflow-policy validator.
3. No PR quality, security, accessibility, responsive, dependency, or supply-chain evidence.
4. No separated preview, staging, production, post-deploy, or scheduled-audit workflow definitions.
5. No threat register, secure-development standard, AI security standard, secrets policy, vulnerability policy, or exception register.
6. No deployment, rollback, access-review, disaster-recovery, or complete incident-response runbook.
7. No canonical secure CI/CD architecture page or decision record.
8. No repository security policy files for data classes, critical paths, actions, dependencies, vulnerabilities, or headers.
9. No contact abuse tests, explicit size gate, timeout, safe structured logging, optional edge limiter contract, or duplicate damping.
10. No browser security-header implementation or CSP exception record.
11. No accessibility/reflow browser suite or tested viewport matrix.
12. No truthful implementation report separating code, documentation, simulation, and external configuration.

## Source import plan

Extend the existing idempotent importer to recognize all three secure CI/CD sources as Tier 1 target/security material. Then:

- copy the three originals into `reference/source-materials/originals/`;
- record size, modification time, repository path, and SHA-256 in both source inventories;
- structurally inspect the 346-element Excalidraw scene and its 208 text elements;
- preserve an editable public copy at `public/diagrams/source/BEACON_SECURE_CICD_ARCHITECTURE_10_OF_10.excalidraw`;
- do not fabricate an SVG or PNG export;
- expose the editable source with a complete textual architecture alternative in Markdoc.

Observed source hashes before import:

| Source | Bytes | SHA-256 |
|---|---:|---|
| `BEACON_SECURE_CICD_ARCHITECTURE_10_OF_10.excalidraw` | 308180 | `116ade3935e9bd57edd7e6134471eb736f62a12de580e2803d1c072436c7d1c2` |
| `BEACON_SECURE_CICD_EXECUTION_PROMPT_10_OF_10.md` | 8704 | `2fe8af669cebbb91ff53f0ae619580c5908865b7a5401a7bc5e42f1e99b7b6f1` |
| `BEACON_SECURE_CICD_IMPLEMENTATION_PLAN_10_OF_10.md` | 13790 | `2812e776c126d3e76b34602177baa54777dd70cdb50c30c85f9645ed895ff10c` |

## Files to create

### GitHub governance

- `.github/CODEOWNERS`
- `.github/dependabot.yml`
- `.github/pull_request_template.md`
- `.github/workflows/pr-policy.yml`
- `.github/workflows/pr-quality.yml`
- `.github/workflows/pr-security.yml`
- `.github/workflows/pr-accessibility-responsive.yml`
- `.github/workflows/preview-deploy.yml`
- `.github/workflows/deploy-staging.yml`
- `.github/workflows/deploy-production.yml`
- `.github/workflows/post-deploy-verify.yml`
- `.github/workflows/scheduled-security-audit.yml`
- `.github/workflows/dependency-review.yml`

Every `uses:` value will be resolved from the official Action repository and pinned to a reviewed 40-character commit SHA with a version comment. No Action SHA will be guessed.

### Canonical Markdoc

The requested `docs/security/*.md` and related Markdown locations are adapted to the established canonical collection:

- `src/content/docs/security/threat-model.mdoc`
- `src/content/docs/security/secure-development-standard.mdoc`
- `src/content/docs/security/ai-agent-security-standard.mdoc`
- `src/content/docs/security/dependency-and-action-policy.mdoc`
- `src/content/docs/security/secrets-management.mdoc`
- `src/content/docs/security/vulnerability-management.mdoc`
- `src/content/docs/security/exception-register.mdoc`
- `src/content/docs/architecture/secure-cicd-architecture.mdoc`
- `src/content/docs/operations/deployment-runbook.mdoc`
- `src/content/docs/operations/rollback-runbook.mdoc`
- `src/content/docs/operations/incident-response-plan.mdoc`
- `src/content/docs/operations/access-review-runbook.mdoc`
- `src/content/docs/operations/disaster-recovery-plan.mdoc`
- `src/content/docs/decisions/0015-adopt-secure-cicd-control-model.mdoc`

### Machine-readable policy

- `security/approved-actions.yml`
- `security/approved-dependencies.yml`
- `security/data-classification.yml`
- `security/security-critical-paths.yml`
- `security/vulnerability-policy.yml`
- `security/headers-policy.yml`

### Validation and evidence

- `eslint.config.js`
- `.prettierrc.json`
- `.prettierignore`
- `playwright.config.ts`
- `scripts/ci/validate-pr-policy.mjs`
- `scripts/ci/validate-workflows.mjs`
- `scripts/ci/check-built-links.mjs`
- `scripts/security/scan-secrets.mjs`
- `scripts/security/check-dependency-policy.mjs`
- `scripts/security/check-licenses.mjs`
- `scripts/security/generate-evidence.mjs`
- `tests/contact/contact-worker.test.ts`
- `tests/security/security-headers.test.ts`
- `tests/integration/site-routes.test.ts`
- `tests/accessibility/site-accessibility.spec.ts`
- `tests/responsive/site-responsive.spec.ts`
- `tests/smoke/site-smoke.spec.ts`
- `secure-cicd-implementation-report.md`

## Files to modify

- `scripts/import-reference-materials.mjs`
- `scripts/inspect-source-materials.mjs`
- `scripts/validate-markdoc.mjs`
- `package.json`
- `package-lock.json` through `npm install` only
- `src/worker.ts`
- `src/components/ContactForm.astro`
- `src/content.config.ts`
- `src/data/docs-navigation.ts`
- relevant current-phase, security, deployment, quality-gate, release, operations, source-map, and open-question `.mdoc` pages
- `README.md`
- `.dev.vars.example` only if a non-secret optional binding/configuration placeholder is needed
- `wrangler.jsonc` only for safe repository-defined headers or non-secret binding shape; no secret values

## Dependencies proposed

All additions must be used by local commands and workflows:

- `prettier` and `prettier-plugin-astro` for format verification;
- `eslint`, `eslint-plugin-astro`, and TypeScript ESLint support for source linting;
- `@playwright/test` and `@axe-core/playwright` for real browser, keyboard, accessibility, and responsive tests;
- `yaml` for deterministic validation of workflow and security policy files.

The existing npm `sbom` command will generate CycloneDX evidence. No separate SBOM package is proposed.

## Implementation sequence

1. Extend and run safe source import; inspect repository-local copies.
2. Add the canonical secure CI/CD ADR, architecture, security standards, operations runbooks, and navigation.
3. Add machine-readable policy files and deterministic validators.
4. Add formatting, lint, built-link, policy, secret, dependency, license, and evidence scripts.
5. Harden the contact Worker and form; add unit/security tests.
6. Add Playwright and axe tests across the required viewport and interaction matrix.
7. Resolve official Action release tags to immutable SHAs and create secretless PR workflows.
8. Create manual, environment-gated preview/staging/production workflow definitions with no embedded credentials.
9. Run local validators, type checking, unit/integration tests, browser tests, docs validation, and production build.
10. Create `secure-cicd-implementation-report.md` with exact results and external blockers.

## Risk and rollback

| Risk | Control | Rollback |
|---|---|---|
| CSP breaks Turnstile, fonts, or existing inline handlers | document required origins; preserve a narrow `script-src-attr` exception; browser-test key routes | revert Worker header policy or the specific directive |
| Contact hardening rejects valid submissions | explicit limits, allow-lists, generic errors, unit tests, unchanged required fields | revert the contact handler commit |
| CI consumes excessive time | split policy, quality, security, and browser jobs; timeouts and concurrency cancellation | disable the affected workflow file in a reviewable revert |
| Workflow supply-chain compromise | minimum permissions, immutable SHAs, allow-list, local validator | remove the Action and use a local script |
| Solo approval deadlock | do not claim independent human approval; keep external environment gate pending | use documented emergency bypass only after risk acceptance |
| Automatic Cloudflare deployment | do not push in this task; require dashboard branch-control review before later publication | disconnect or restrict non-production branch builds in Cloudflare |
| Imported diagram is mistaken for current implementation | mark it target/proposed and pair it with a current-state table | revert the source import and Markdoc proposal |
| New tooling adds vulnerable or incompatible packages | install through npm, review lockfile, run audit when network is available, enforce dependency policy | uninstall the package and revert lockfile through npm |

## Human GitHub configuration still required

1. Create an active `Protect main` ruleset requiring pull requests, current branches, resolved conversations, required checks, linear history, and no force-push or deletion.
2. Keep required PR approvals at zero while only one accountable human exists; raise to one when another human collaborator joins.
3. Create `preview`, `staging`, and `production` environments.
4. Restrict production to protected `main`, add a second human reviewer, and enable prevent-self-review before calling the production gate active.
5. Store separate preview, staging, and production Cloudflare credentials only in the matching environments.
6. Enable and verify dependency graph, Dependabot alerts, CodeQL/default setup as appropriate, secret scanning, push protection, and private vulnerability reporting.
7. Configure the Actions allow-list and require immutable Action SHAs.
8. Select required check names only after the new workflows have run successfully.
9. Review emergency bypass access and record every bypass in the exception register.

## Human Cloudflare configuration still required

1. Verify the production branch and current non-production branch-build behavior.
2. Create isolated preview and staging Worker resources, routes, domains, variables, and test destinations.
3. Create separate least-privilege API tokens for preview, staging, and production.
4. Put tokens only in the corresponding protected GitHub environments and document rotation.
5. Configure rate limiting or WAF controls for `/api/contact`.
6. Verify Turnstile hostnames, CSP origins, Resend destination behavior, and redacted logging.
7. Configure rollback access and retain the last known-good deployment evidence.

## Features unavailable or not truthful today

- Organization-team CODEOWNER approval is unavailable in this user-owned repository.
- Two-person PR approval and production prevent-self-review cannot be satisfied with one human operator.
- GitGalaxy remains excluded from commercial CI pending licensing confirmation.
- Same-artifact preview-to-staging-to-production promotion cannot be claimed until isolated resources, environments, credentials, and successful workflow evidence exist.
- A workflow definition is not evidence that a workflow passed.
- A documented rate-limit design is not evidence that a Cloudflare rate-limit rule is active.
- Signed commits will remain advisory until the owner configures and verifies signing.

## Completion evidence

Completion requires:

- no uncommitted source outside this repository;
- local format, lint, type, unit, integration, policy, workflow, docs, accessibility, responsive, security-header, link, and build checks to pass where locally executable;
- immutable Action references;
- a generated SBOM and artifact digest;
- no production deployment;
- a final report that distinguishes implemented code, configured definitions, documentation, simulation, external pending controls, and genuine blockers.
