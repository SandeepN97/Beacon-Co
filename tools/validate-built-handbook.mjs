import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const toolsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(toolsDirectory, "..");
const readBuiltPage = (...segments) =>
  readFile(join(projectRoot, "docs-site", ...segments, "index.html"), "utf8");

const pages = [
  {
    name: "current architecture",
    path: ["architecture"],
    diagrams: 1,
  },
  {
    name: "architecture decision",
    path: [
      "decisions",
      "0003-record-architecture-evolution-and-source-atlas",
    ],
    diagrams: 4,
  },
  {
    name: "operating-model decision",
    path: [
      "decisions",
      "0004-use-a-durable-ai-assisted-operating-model",
    ],
    diagrams: 2,
  },
];

for (const page of pages) {
  const html = await readBuiltPage(...page.path);
  const renderedDiagrams =
    html.match(/class="mermaid"/g)?.length ?? 0;

  assert.equal(
    renderedDiagrams,
    page.diagrams,
    `${page.name} should contain ${page.diagrams} Mermaid containers`,
  );
  assert(
    html.includes("assets/vendor/mermaid.min.js"),
    `${page.name} must load the pinned local Mermaid runtime`,
  );
  assert(
    !/<pre[^>]*>[\s\S]*?<code[^>]*mermaid/.test(html),
    `${page.name} still exposes a Mermaid definition as a code block`,
  );
}

const home = await readBuiltPage();
for (const route of [
  "0001-why-beacon-exists-and-business-definition",
  "0002-define-brand-and-customer-experience",
  "0003-record-architecture-evolution-and-source-atlas",
  "0004-use-a-durable-ai-assisted-operating-model",
]) {
  assert(
    home.includes(route),
    `Homepage is missing the ${route} decision route`,
  );
}
assert(
  home.includes("assets/stylesheets/main."),
  "Built handbook does not appear to use the Material theme",
);
assert(
  home.includes("stylesheets/brand.css"),
  "Built handbook is missing the Beacon brand layer",
);

console.log(
  "Built handbook validated: 7 Mermaid containers, pinned local runtime, four decision routes, Material theme, and Beacon brand layer",
);

