# Setup

```bash
# 1. Scaffold the project
npm create cloudflare@latest -- beacon-site --framework=astro --platform=pages
cd beacon-site

# 2. Drop in the project brief files (from this bundle)
cp ../CLAUDE.md .
mkdir -p docs && cp ../docs/*.md docs/
mkdir -p reference && cp /path/to/veslyn-v9.html reference/v9-source.html
mkdir -p public/brand && cp /path/to/beacon-*.svg public/brand/

# 3. Start Claude Code in this directory
claude

# 4. Paste the contents of KICKOFF_PROMPT.md as your first message
```

Claude Code reads `CLAUDE.md` automatically at the start of the session — you don't
paste that in, it's already loaded before your first message. `KICKOFF_PROMPT.md` is
the one thing you actually type.

Work through it component by component, checking `localhost:4321` after each one, per
the checkpoints the kickoff prompt asks for. Once every component is ported and
`npm run build` succeeds cleanly, you're ready to git init, push to the Beacon-Co repo,
and connect Cloudflare Pages for auto-deploy on every push — covered in the local-build
walkthrough from earlier in this conversation.
