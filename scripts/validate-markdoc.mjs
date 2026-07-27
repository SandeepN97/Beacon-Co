import { access, readFile, readdir } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const contentRoot = join(root, "src", "content", "docs");
const allowedStatuses = new Set(["draft", "under-review", "approved", "superseded"]);
const allowedSections = new Set([
  "home", "getting-started", "product", "plans", "architecture", "agents",
  "workflows", "governance", "decisions", "operations", "references",
]);
const requiredFields = [
  "title", "description", "section", "order", "status", "lastReviewed", "owners",
  "sourceFiles", "relatedAdrs", "relatedPages", "tags", "truthState",
];
const requiredAgentHeadings = [
  "Purpose", "Business department or lane", "Single responsibility", "When to use",
  "Approved inputs", "Required output or document", "Allowed tools",
  "Prohibited actions", "Write-access level", "Required evidence",
  "Acceptance criteria", "Stop condition", "Second-voice review",
  "Human approval rule", "Defect return target", "Recommended next agent",
  "Failure and escalation behavior", "Example universal handoff",
];
const requiredAdrHeadings = [
  "Context", "Decision drivers", "Options considered", "Decision",
  "Positive consequences", "Negative consequences", "Risks", "Follow-up work",
  "Supersedes or superseded by", "Source references",
];

async function walk(directory, predicate = (name) => extname(name) === ".mdoc") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(child, predicate)));
    else if (predicate(entry.name)) files.push(child);
  }
  return files;
}

function parseValue(value) {
  try {
    return JSON.parse(value.trim());
  } catch {
    return value.trim().replace(/^["']|["']$/g, "");
  }
}

function parsePage(source, file) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error(`${file}: missing frontmatter`);
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 1) continue;
    data[line.slice(0, separator).trim()] = parseValue(line.slice(separator + 1));
  }
  return { data, body: match[2] };
}

function docsIdFromHref(href) {
  if (href === "/docs/" || href === "/docs") return "index";
  return href.replace(/^\/docs\//, "").replace(/\/$/, "").split(/[?#]/)[0];
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const errors = [];
const files = await walk(contentRoot);
const pages = [];
for (const file of files) {
  const source = await readFile(file, "utf8");
  const id = relative(contentRoot, file).replace(/\.mdoc$/, "").replaceAll("\\", "/");
  let parsed;
  try {
    parsed = parsePage(source, id);
  } catch (error) {
    errors.push(String(error));
    continue;
  }
  pages.push({ id, source, ...parsed });
}

const idSet = new Set(pages.map(({ id }) => id));
if (idSet.size !== pages.length) errors.push("Duplicate Markdoc IDs detected.");
if (!idSet.has("index")) errors.push("Missing canonical docs index.");

for (const page of pages) {
  for (const field of requiredFields) {
    if (!(field in page.data)) errors.push(`${page.id}: missing frontmatter field ${field}`);
  }
  if (!allowedStatuses.has(page.data.status)) errors.push(`${page.id}: invalid status ${page.data.status}`);
  if (!allowedSections.has(page.data.section)) errors.push(`${page.id}: unknown section ${page.data.section}`);
  if (!Array.isArray(page.data.owners) || !page.data.owners.length) errors.push(`${page.id}: at least one owner is required`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(page.data.lastReviewed ?? "")) errors.push(`${page.id}: invalid review date`);
  if (/<script\b|<iframe\b|on[a-z]+=/i.test(page.body)) errors.push(`${page.id}: unsafe raw HTML is not allowed`);

  for (const related of page.data.relatedPages ?? []) {
    if (!idSet.has(related)) errors.push(`${page.id}: related page does not exist: ${related}`);
  }
  for (const adr of page.data.relatedAdrs ?? []) {
    if (!idSet.has(`decisions/${adr}`)) errors.push(`${page.id}: related ADR does not exist: ${adr}`);
  }
  for (const match of page.body.matchAll(/\]\((\/docs\/[^)]+)\)/g)) {
    let target = docsIdFromHref(match[1]);
    if (!idSet.has(target) && idSet.has(`${target}/index`)) {
      target = `${target}/index`;
    }
    if (!idSet.has(target)) errors.push(`${page.id}: internal docs link does not exist: ${match[1]}`);
  }
  for (const match of page.body.matchAll(/(?:src|source)="(\/diagrams\/[^"]+)"/g)) {
    if (!(await exists(join(root, "public", match[1])))) errors.push(`${page.id}: diagram path does not exist: ${match[1]}`);
  }
  for (const sourceFile of page.data.sourceFiles ?? []) {
    if (!(await exists(join(root, sourceFile)))) errors.push(`${page.id}: source file does not exist: ${sourceFile}`);
  }

  if (/^agents\/(chief|program|market|business-analyst|product-manager|ux-ui|solution|security|codebase|code-writer|qa|pr-reviewer|devops|release-manager)/.test(page.id)) {
    for (const heading of requiredAgentHeadings) {
      if (!page.body.includes(`## ${heading}`)) errors.push(`${page.id}: missing agent contract heading “${heading}”`);
    }
  }
  if (/^decisions\/\d{4}-/.test(page.id)) {
    for (const heading of requiredAdrHeadings) {
      if (!page.body.includes(`## ${heading}`)) errors.push(`${page.id}: missing ADR heading “${heading}”`);
    }
  }
}

const searchIndex = JSON.parse(await readFile(join(root, "public", "search-index.json"), "utf8"));
if (searchIndex.length !== pages.length) {
  errors.push(`Search index has ${searchIndex.length} records for ${pages.length} pages.`);
}

const expectedDiagramSources = [
  "ai_company_all_agents_and_combined_canvas.excalidraw",
  "easy_read_ai_company_architecture.excalidraw",
  "individual_agent_architecture_animated.excalidraw",
  "unified_agent_operating_architecture_all_in_one.excalidraw",
  "multi_agent_business_broker_end_to_end.excalidraw",
];
for (const name of expectedDiagramSources) {
  if (!(await exists(join(root, "public", "diagrams", "source", name)))) {
    errors.push(`Missing public diagram source: ${name}`);
  }
}

const sourceFiles = await walk(
  join(root, "src"),
  (name) => /\.(astro|ts|js|css)$/.test(name),
);
for (const file of sourceFiles) {
  const source = await readFile(file, "utf8");
  if (/\b(localStorage|sessionStorage)\b/.test(source)) {
    errors.push(`${relative(root, file)}: prohibited browser storage reference`);
  }
}

if (errors.length) {
  console.error(`Markdoc validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Validated ${pages.length} Markdoc pages, navigation references, sources, diagrams, agent contracts, ADR contracts, and search entries.`);
