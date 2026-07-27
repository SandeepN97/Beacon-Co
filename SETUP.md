# Local Setup

The initial Astro migration is complete. This file describes the current repository setup.

## Prerequisites

- Node.js 22.12 or newer
- npm
- Python 3, MkDocs 1.6.1, and MkDocs Material 9.7.1 only if you need the retained legacy handbook

## Install

```sh
npm install
```

For the optional legacy documentation build only:

```sh
python3 -m pip install -r requirements-docs.txt
```

## Application

```sh
npm run dev
npm run build
npm run preview
```

The Astro development server uses `http://localhost:4321`.

For local Cloudflare Worker and contact-route testing:

1. Copy `.dev.vars.example` to `.dev.vars`.
2. Add local secret values.
3. Run `npx wrangler dev`.

Never commit `.dev.vars` or other environment files.

## Canonical project handbook

```sh
npm run docs:index
npm run docs:validate
npm run docs:serve
npm run docs:build
```

The Astro documentation server uses `http://127.0.0.1:8000`. The canonical build validates Markdoc frontmatter, links, source references, diagram paths, agent and ADR contracts, and the generated search index before building the unified static site to `dist/`.

Start reading at `src/content/docs/index.mdoc` or `/docs/`. Every material project change must update the relevant `.mdoc` page. Significant decisions also require one reviewable ADR.

The previous MkDocs handbook is retained as migration evidence:

```sh
npm run docs:legacy:build
```

## AI coding agents

- Codex reads `AGENTS.md`.
- Claude Code reads `CLAUDE.md`, which is a symlink to `AGENTS.md`.
- Both agents therefore share the same durable project rules.
- The optional Bridge Work workflow is documented in `docs/ai-agent-workflow.md`.

Do not use `KICKOFF_PROMPT.md` for current work; it is retained only as a historical record of the completed initial migration.
