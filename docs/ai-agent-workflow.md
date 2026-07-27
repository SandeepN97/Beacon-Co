# Claude Code ↔ Codex workflow

This setup separates context into three layers:

1. `AGENTS.md` / `CLAUDE.md`: durable project rules loaded by both agents.
2. Git and the working tree: the authoritative implementation state.
3. `.ai/handoff.md`: a short local checkpoint for the one active task.

Do not move whole transcripts between agents during normal work. They are expensive, noisy, and less reliable than the actual files and a verified checkpoint.

## One-time setup

In the ChatGPT desktop app, open **Settings → Import** (or **General → Import other agent setup**) and import Claude Code. ChatGPT can import supported instructions, settings, skills, project folders, and chats from the last 30 days without changing the Claude setup.

The repo's `CLAUDE.md` already points to `AGENTS.md`, so both tools receive the same project rules.

## Daily commands

Claude Code:

```text
/bridge-work rough: <write your unfiltered thought here>
/bridge-work handoff
/bridge-work continue
```

Codex:

```text
$bridge-work rough: <write your unfiltered thought here>
$bridge-work handoff
$bridge-work continue
```

`rough` creates a five-part working brief and executes it in the same turn. Use `prompt-only` instead of `rough` when you want a polished, copyable prompt but no action.

Before switching tools, run `handoff`. In the next tool, run `continue`. If Claude hits its cap before a handoff, use `recover`; the agent will reconstruct only what Git, the working tree, and any older checkpoint support.

Native session resume remains useful when returning to the same tool:

```sh
claude --continue
claude --resume
codex resume --last
```

## Low-token habits

- Keep one task per session. Start fresh when the next task is unrelated.
- Point to file paths and symptoms; do not paste files the agent can read.
- Include a concrete done condition and a check the agent can run.
- Ask the agent to inspect only targeted diffs and relevant files.
- Save a handoff before switching; keep it under 60 lines.
- Compact long sessions with a focus on decisions, changed paths, validation, and next action.
- Disable MCP servers and other tools you are not using.

Useful checks:

- Claude Code: `/context`, `/usage`, `/compact <focus>`, `/clear`
- Codex: `/statusline` (enable context and token counters), `/compact`

## Compact rough-note pattern

If the skill is unavailable, use this one-line fallback:

```text
Turn this rough note into a five-bullet working brief (outcome, context, constraints, done condition, authority), state non-blocking assumptions, then execute in this same turn: <notes>
```

## Official references

- [Import from another agent](https://learn.chatgpt.com/codex/import)
- [Codex custom instructions with AGENTS.md](https://developers.openai.com/codex/guides/agents-md)
- [Codex CLI commands](https://developers.openai.com/codex/cli/reference)
- [Claude Code memory and CLAUDE.md](https://code.claude.com/docs/en/memory)
- [Claude Code sessions](https://code.claude.com/docs/en/sessions)
- [Claude Code context window](https://code.claude.com/docs/en/context-window)
- [Claude Code token usage guidance](https://code.claude.com/docs/en/costs)
