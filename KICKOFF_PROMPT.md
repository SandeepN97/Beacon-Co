# The kickoff prompt

Paste this into Claude Code once it's running inside the scaffolded Astro project
(after CLAUDE.md, docs/architecture.md, docs/brand.md, and reference/v9-source.html
are all in place — see SETUP.md).

---

Read CLAUDE.md, docs/architecture.md, and docs/brand.md fully before doing anything else.

Then read reference/v9-source.html in full — it's the existing site this project replaces.

Your task: split it into Astro components under src/components/, one per section
(Hero, SocialDemo, ProcessSteps, Services, PricingCards, ContactForm, Sketch, Footer),
a shared src/layouts/BaseLayout.astro for the <head>/nav/footer, and src/pages/index.astro
that imports and orders everything.

Rules for this pass:
- Port content and behavior faithfully. Do not redesign, rewrite copy, or "improve"
  anything — that's a separate task, ask me first if you think something should change.
- Any JS scoped to one section (tab switching, scroll-spy, the self-drawing sketch
  animation) moves into a <script> tag inside that section's own component — don't
  create a single global script file.
- Move the existing CSS into src/styles/global.css mostly as-is. Only refactor
  selectors that literally can't work once the HTML is split into separate files.
- Stop and ask me before installing any new dependency that isn't already in
  CLAUDE.md's stack list.

Work through components one at a time. After each one, run `npm run dev` and tell me
what to check in the browser before you move to the next component — don't do all
eight in one pass with no checkpoint.

Start with BaseLayout.astro and Hero.astro, then stop and show me.
