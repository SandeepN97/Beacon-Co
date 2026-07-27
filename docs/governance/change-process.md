# Change Process

## Before work

1. Read [Current State](../current-state.md) and the relevant domain page.
2. Check the [Decision Register](../decisions/index.md) for existing constraints.
3. If a significant direction is undecided, create a `proposed` ADR before implementation.
4. Define the expected outcome and verification.

## During work

1. Keep code, specifications, and decisions aligned.
2. Do not implement later-phase systems merely because they are documented.
3. Record new assumptions instead of presenting them as facts.
4. For UI work, compare against the experience and brand specifications.

## After work

1. Update the current-state or domain page.
2. Accept, reject, or supersede any affected ADR.
3. Add a dated change record from [the template](../changes/template.md).
4. Update roadmap status.
5. Run relevant checks, including `npm run docs:build`.

## Fast decision test

Create an ADR when a change answers one of these questions:

- Which platform, framework, service, or dependency will we rely on?
- Which security, data, deployment, or integration pattern will we adopt?
- Which user-experience or brand rule should future work preserve?
- Which business model, price structure, guarantee, or operating rule should govern the company?
- Is the choice costly, difficult to reverse, or likely to be questioned later?

Use only a change record when the work implements an already accepted direction without changing it.

## Conflict handling

When documentation and the repository disagree:

1. Verify the executable state from source, configuration, tests, and deployment evidence.
2. Record the discrepancy in [Current State](../current-state.md).
3. Determine whether implementation or intended direction is wrong.
4. Correct both sides in one coherent change.
5. Create or supersede an ADR if the direction changed.

Never resolve drift by quietly rewriting history.
