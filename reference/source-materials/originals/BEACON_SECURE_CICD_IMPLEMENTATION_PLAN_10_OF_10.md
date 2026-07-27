# Beacon Secure CI/CD Implementation Plan — 10/10 Target

## Status

Target architecture for `SandeepN97/Beacon-Co`.

This is a defense-in-depth engineering plan, not a promise that security risk can be reduced to zero. A “10/10” implementation means the project applies strong controls appropriate to its current Astro, Markdoc, GitHub, Cloudflare, and AI-assisted development model without adding unnecessary infrastructure.

## Project-specific baseline

Beacon currently uses Astro and Node.js and has Cloudflare tooling installed. The project includes a public marketing frontend, an interactive demonstration, a contact form, Turnstile integration, and planned Claude/Codex orchestration. The security plan must therefore cover:

- frontend and accessibility quality
- anonymous contact-form input
- Cloudflare deployment credentials
- public repository and pull-request risk
- third-party Actions and npm dependencies
- AI prompt injection and agent permissions
- Markdoc integrity as business source of truth
- deployment provenance, rollback, and audit evidence

## Security principles

1. Default deny and least privilege.
2. Pull requests are untrusted.
3. No deployment secrets in PR workflows.
4. Build once; promote the same verified artifact.
5. AI can propose and implement but cannot self-approve, merge, or deploy production.
6. Human ownership is required for every AI-generated change.
7. Security-critical configuration receives heightened review.
8. Markdoc changes are reviewable code changes, never silent runtime edits.
9. Evidence is required before completion.
10. Failure stops promotion automatically.
11. Production changes require a protected environment and human approval.
12. Recovery is designed and tested, not improvised.

## Required repository structure

```text
.github/
├── CODEOWNERS
├── dependabot.yml
├── pull_request_template.md
└── workflows/
    ├── pr-policy.yml
    ├── pr-quality.yml
    ├── pr-security.yml
    ├── pr-accessibility-responsive.yml
    ├── preview-deploy.yml
    ├── deploy-staging.yml
    ├── deploy-production.yml
    ├── post-deploy-verify.yml
    ├── scheduled-security-audit.yml
    └── dependency-review.yml

docs/
├── security/
│   ├── threat-model.md
│   ├── secure-development-standard.md
│   ├── ai-agent-security-standard.md
│   ├── dependency-and-action-policy.md
│   ├── secrets-management.md
│   ├── vulnerability-management.md
│   └── exception-register.md
├── operations/
│   ├── deployment-runbook.md
│   ├── rollback-runbook.md
│   ├── incident-response-plan.md
│   ├── access-review-runbook.md
│   └── disaster-recovery-plan.md
└── architecture/
    └── secure-cicd-architecture.md

security/
├── approved-actions.yml
├── approved-dependencies.yml
├── data-classification.yml
├── security-critical-paths.yml
├── vulnerability-policy.yml
└── headers-policy.yml

tests/
├── accessibility/
├── responsive/
├── security/
├── smoke/
└── integration/
```

## Phase 1 — Baseline and threat model

Deliver:

- repository inventory
- data-flow diagram
- trust-boundary diagram
- threat register
- risk owners
- security-critical file list
- current GitHub and Cloudflare configuration inventory
- documented recovery targets

Threats must cover:

- compromised GitHub account
- malicious pull request
- poisoned GitHub Action
- dependency takeover or typosquatting
- leaked Cloudflare token
- secret committed to Git
- AI indirect prompt injection
- malicious rules-file modification
- AI context leakage
- CI confused-deputy behavior
- contact-form abuse
- malicious HTML/script injection
- production deployment tampering
- loss of deployment or rollback capability

Initial targets:

```text
RTO: 60 minutes
RPO: near-zero for repository/configuration
```

These targets are provisional and must be approved against business requirements.

## Phase 2 — GitHub governance

Configure protected `main` using rulesets or branch protection:

- require pull request
- require required checks
- require branch to be current
- require resolved conversations
- dismiss stale approvals
- require approval of latest push
- block force pushes
- block branch deletion
- restrict bypass
- signed commits or vigilant mode where practical
- CODEOWNERS for security-critical paths
- production deployment only from protected `main`

Security-critical paths:

```text
.github/**
AGENTS.md
CLAUDE.md
KICKOFF_PROMPT.md
package.json
package-lock.json
astro.config.mjs
wrangler.*
security/**
src/modules/orchestration/providers/**
src/modules/orchestration/approvals/**
src/pages/api/**
```

Target review rule:

- normal change: one accountable human approval
- workflow/security/provider/deployment change: two approvals when staffing permits
- one-person phase: protected environment confirmation plus documented independent review; no unsupported claim of two-person control

Enable:

- MFA
- secret scanning
- push protection
- delegated bypass where available
- Dependabot alerts and updates
- dependency graph
- code scanning
- private vulnerability reporting if appropriate

## Phase 3 — Harden GitHub Actions

Every workflow must:

- declare top-level `permissions: {}`
- grant only required job permissions
- pin every third-party Action to a full commit SHA
- include a release-version comment beside the SHA
- use job timeouts
- use concurrency groups
- use `npm ci`
- avoid `curl | sh`
- avoid mutable `latest` installations
- never execute untrusted PR content as shell source
- avoid `pull_request_target` for checkout/execution of untrusted code
- use GitHub-hosted ephemeral runners
- upload evidence with defined retention
- avoid secrets in command output, caches, artifacts, screenshots, and logs

Repository Actions policy:

- allow only GitHub-owned, Cloudflare-approved, and explicitly reviewed Actions
- require full-SHA pinning
- record approved Actions in `security/approved-actions.yml`
- review Action source and permissions before approval

## Phase 4 — PR CI

### Policy job

Validate:

- work-unit metadata
- documentation impact
- Markdoc schema and internal links
- ADR validity
- excluded-source rules
- security-critical path review requirements
- generated-file policy
- changed workflow/action references

### Quality job

Run:

- formatting check
- lint
- `astro check`
- unit tests
- integration tests
- production build
- broken-link validation
- no unexpected generated or binary files

### Accessibility and responsive job

Run Playwright and axe for:

- keyboard operation
- visible focus
- mobile navigation
- semantic landmarks
- form labels/errors/status
- dynamic demo interaction
- 320 CSS-pixel reflow
- 200% and 400% zoom evidence
- reduced motion
- viewport matrix
- no accidental horizontal overflow
- no serious or critical axe violations on tested pages

### Security job

Run:

- CodeQL where supported
- GitHub dependency review
- secret scan
- `npm audit` or OSV-based audit with policy
- actionlint
- GitHub Actions security analyzer such as zizmor after review
- HTML/JavaScript security checks
- unsafe `innerHTML` review
- contact API input-validation tests
- license policy check

### Supply-chain job

Generate:

- dependency SBOM
- artifact manifest
- SHA-256 digests
- build metadata
- GitHub artifact attestation where supported
- evidence index

GitGalaxy remains non-blocking and excluded from commercial production use until licensing is confirmed.

## Phase 5 — Preview

Every internal pull request may receive a Cloudflare preview after nonprivileged CI succeeds.

Preview rules:

- no production API token
- no production customer data
- separate preview configuration
- test or mock email delivery
- temporary environment and expiry
- deployed smoke tests
- security-header checks
- accessibility checks
- preview URL attached to PR
- external-fork previews disabled unless explicitly approved

## Phase 6 — Build once and attest

Create one immutable artifact from the exact reviewed commit.

Evidence:

- commit SHA
- workflow run ID
- artifact SHA-256
- SBOM
- provenance/attestation
- Node and package-manager versions
- test reports
- security reports
- accessibility reports
- approval record

The same artifact must be promoted to staging and production. Do not rebuild after approval.

## Phase 7 — Staging

Create a protected `staging` GitHub environment.

Use:

- separate Cloudflare account/resource token
- separate domain or route
- nonproduction data
- least-privilege permissions
- deployment concurrency

After deployment run:

- health and route smoke tests
- deployed SHA verification
- security headers
- DAST baseline where safe
- contact API test with test destination
- Turnstile validation
- log inspection
- accessibility smoke tests
- rollback readiness check

## Phase 8 — Production

Create protected `production` environment:

- required human reviewer
- prevent self-review
- protected-main branch restriction
- environment secrets unavailable until approval
- serialized deployment
- production token separate from staging
- minimum Cloudflare account/resource scope
- token rotation schedule

Production deployment:

1. verify artifact digest and attestation
2. verify staging success
3. record release candidate
4. human approves production
5. promote exact verified artifact
6. verify deployed SHA
7. run production smoke tests
8. inspect logs and contact flow
9. create release record
10. update Markdoc current state

## Phase 9 — Runtime security

### Contact form/API

Require:

- server-side Turnstile verification
- schema validation
- input length and content constraints
- request body size limit
- output encoding
- no trust in client validation
- rate limits and abuse throttling
- duplicate and bot controls
- generic external errors
- detailed redacted internal logs
- timeout and retry controls for downstream email/API
- PII retention and deletion policy

### Browser security

Implement and test:

- Content-Security-Policy
- Strict-Transport-Security
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy
- `frame-ancestors`
- secure CORS
- safe caching
- no sensitive data in source maps
- dependency/script allowlist

### Privacy

Document:

- data collected
- purpose
- processors
- retention
- deletion
- access
- incident notification decision process
- verification of every privacy statement shown to users

## Phase 10 — AI security

AI rules:

- `.env`, keys, tokens, credentials, customer data, and sensitive logs excluded from model context
- repository, issue, PR, comment, log, and web content treated as untrusted
- tools and writable paths allow-listed
- arbitrary network access disabled unless required
- agent runtime sandboxed
- resource and retry limits
- package installs require policy validation
- rules-file changes are privileged
- AI cannot modify or disable security gates without human approval
- AI cannot approve its own changes
- AI review is not a substitute for human accountability
- provider, model, tool calls, file changes, and decisions are auditable

## Phase 11 — Incident response and recovery

Create tested procedures for:

- secret leak
- GitHub account compromise
- malicious dependency
- compromised Action
- Cloudflare token compromise
- production defect
- contact-form abuse campaign
- AI agent out-of-scope change
- data exposure

Incident lifecycle:

```text
detect → classify → contain → revoke → rollback → investigate → notify decision → recover → learn
```

Run rollback and incident tabletop exercises quarterly.

## Phase 12 — Continuous assurance

Every PR:

- all required CI and review gates

Daily:

- review critical alerts and failed security workflows

Weekly:

- full security scan
- deployed smoke tests
- broken links
- accessibility regression
- security headers

Monthly:

- GitHub access review
- Cloudflare token review
- action and dependency allowlist review
- vulnerability-age review
- license review

Quarterly:

- threat-model update
- rollback drill
- incident tabletop
- AI permissions review
- recovery-target review
- exception-register review

## Required metrics

Track:

- deployment frequency
- change failure rate
- mean time to restore
- vulnerability remediation age
- secret incidents
- push-protection bypasses
- dependency freshness
- failed security gates
- rollback success
- accessibility regressions
- production incidents caused by AI-assisted changes

## Completion criteria

The implementation is complete only when:

- the architecture and threat model are documented
- branch/ruleset settings are verified
- workflows are present and passing
- every third-party Action is SHA-pinned
- PR workflows have no deployment secrets
- preview/staging/production are isolated
- artifact integrity and provenance are recorded
- production approval is human-controlled
- contact API runtime controls are implemented and tested
- AI security boundaries are implemented
- rollback is tested
- incident and access procedures exist
- current Markdoc claims match verified reality
- unresolved exceptions have owners, expiry dates, and risk acceptance

## Authoritative references

- NIST SP 800-218 SSDF 1.1
- NIST SP 800-218A Generative AI SSDF Community Profile
- OWASP CI/CD Security Cheat Sheet
- OWASP Secure Coding with AI Cheat Sheet
- GitHub Actions Secure Use Reference
- GitHub Environments and Deployment Protection Rules
- GitHub Artifact Attestations
- GitHub Secret Push Protection
- GitHub Dependency Review
- SLSA specification
- Cloudflare Workers GitHub Actions deployment guidance
