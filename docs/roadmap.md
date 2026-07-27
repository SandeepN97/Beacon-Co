---
title: Roadmap
date: 2026-07-26
---

# Roadmap

The roadmap separates delivered capability from accepted but unimplemented direction. A documented future system is not authorization to scaffold it.

## Phase 1 — Marketing and lead capture

Status: **implemented, with business launch items remaining**

Completed:

- Astro marketing site and section components
- Brand token implementation
- Responsive static production build
- Cloudflare Worker deployment with static assets
- Turnstile-protected contact submission
- Resend email delivery
- Automatic deployment from `main`
- Source-of-truth project handbook

Remaining:

- Finalize and purchase the business domain
- Complete formal trademark diligence
- Replace the Resend shared sender with a verified business-domain sender
- Perform a final naming/copy pass after the name is locked
- Establish automated application checks beyond the production build

## Phase 2 — Data, security, and job foundation

Status: **planned; do not build without explicit authorization**

Planned outcomes:

- Isolated development and production Supabase projects
- Initial schema and row-level security policies
- Storage and realtime foundations
- pg-boss queue on Postgres
- Retry policy and dead-letter workflow
- OAuth token encryption, refresh, and expiry alerts
- Backup schedule and restore drills
- Error, log, uptime, cost, and quota monitoring

Entry criteria:

- Phase 1 business identity is finalized.
- Initial lead workflow requirements are validated.
- Data retention and access requirements are written.
- Relevant planned ADRs are revalidated against current vendor capabilities and pricing.

## Phase 3 — Admin and operational automation

Status: **planned; do not build without explicit authorization**

Planned outcomes:

- Next.js admin dashboard on Vercel
- Lead and audit pipeline
- Client and subscription management
- Content calendar and approval queue
- Six bounded service workers
- Versioned AI prompts and structured outputs
- Media generation pipeline
- Transitional and then native social publishing
- Reporting and operational replay tools

Entry criteria:

- Phase 2 data and queue foundations are working and tested.
- Approval and publishing workflows are documented.
- Platform credentials and review requirements are understood.
- Human fallback behavior is defined for every automated output.

## Decision review points

Before each future phase begins:

1. Review all related accepted ADRs.
2. Confirm assumptions against current product requirements.
3. Recheck vendor pricing, terms, API availability, and operational constraints.
4. Supersede outdated ADRs instead of silently editing their historical rationale.
5. Convert the phase outcome into implementation-sized change records.
