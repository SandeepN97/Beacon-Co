---
name: bridge-work
description: Turn rough thoughts into compact executable task briefs, save a minimal cross-agent checkpoint, or resume interrupted work from that checkpoint. Use when the user says rough, shape this, prompt-only, handoff, switch agents, continue, resume, recover, or preserve context between Claude Code and Codex.
---

# Bridge Work

Choose the mode from the user's first word. If omitted, infer it from intent.

## Rough

For `rough: <notes>`:

1. Derive only the outcome, relevant context, hard constraints, done condition, and authorized action.
2. State non-blocking assumptions instead of asking about them. Ask at most one question only when proceeding could materially change the result.
3. Show a working brief of at most five bullets.
4. Execute the task in the same turn. Do not spend a separate turn polishing a prompt.

For `prompt-only: <notes>`, return the smallest copyable prompt that preserves those five elements, then stop without executing it.

## Handoff

For `handoff`:

1. Inspect the active objective, decisions, `git status --short`, `git diff --stat`, targeted diffs, and relevant validation results.
2. Replace `.ai/handoff.md` with a checkpoint using the headings from `.ai/handoff.template.md`.
3. Keep it under 60 lines. Record file paths and command outcomes; never paste transcripts, full diffs, large logs, credentials, or speculative history.
4. Do not change project code while preparing the checkpoint unless the user also asked for a code change.

## Continue or Recover

For `continue`, `resume`, or `recover`:

1. Read `.ai/handoff.md`, then verify it against `git status --short`, `git diff --stat`, targeted diffs, and the relevant source files. Treat checkpoint claims as hints, not proof.
2. If the checkpoint is absent or stale, reconstruct only what is supported by the working tree and recent commits. State any important uncertainty.
3. Continue from the exact next action without re-reading unrelated files or repeating completed research.
4. Update `.ai/handoff.md` after reaching a meaningful new checkpoint.
