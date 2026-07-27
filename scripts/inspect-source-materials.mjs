import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, extname, relative } from "node:path";

const root = new URL("../", import.meta.url);
const sourceRoot = new URL("../reference/source-materials/", import.meta.url);
const originalsRoot = new URL("./originals/", sourceRoot);
const extractedRoot = new URL("./extracted/", sourceRoot);
const outputJson = new URL("./inventory/source-assessment.json", sourceRoot);
const outputMarkdown = new URL("./inventory/source-assessment.md", sourceRoot);

const normalizeText = (value) =>
  value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const hash = (buffer) => createHash("sha256").update(buffer).digest("hex");

async function walk(directoryUrl) {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directoryUrl);
    if (entry.isDirectory()) files.push(...(await walk(child)));
    else files.push(child);
  }
  return files;
}

function inspectHtml(buffer, filename) {
  const html = buffer.toString("utf8");
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const headings = [...html.matchAll(/<(h[1-4])[^>]*>([\s\S]*?)<\/\1>/gi)].map(
    ([, level, content]) => ({
      level: level.toLowerCase(),
      text: normalizeText(content),
    }),
  );
  return {
    kind: "html",
    title: title ? normalizeText(title) : basename(filename),
    headings,
    mermaidBlocks: (html.match(/class=["'][^"']*\bmermaid\b/gi) ?? []).length,
    inlineSvgElements: (html.match(/<svg\b/gi) ?? []).length,
    iframeElements: (html.match(/<iframe\b/gi) ?? []).length,
    interactiveControls: (html.match(/<(button|input|select|textarea)\b/gi) ?? []).length,
    legacyVeslynReferences: (html.match(/\bveslyn\b/gi) ?? []).length,
  };
}

function inspectExcalidraw(buffer) {
  const scene = JSON.parse(buffer.toString("utf8"));
  const elements = Array.isArray(scene.elements) ? scene.elements : [];
  const counts = {};
  for (const element of elements) {
    counts[element.type] = (counts[element.type] ?? 0) + 1;
  }
  const labels = elements
    .filter((element) => element.type === "text" && typeof element.text === "string")
    .map((element) => element.text.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const frames = elements
    .filter((element) => element.type === "frame")
    .map((element) => element.name || element.id);
  const ordered = elements.filter(
    (element) =>
      Number.isFinite(element.animateOrder) ||
      Number.isFinite(element.customData?.animateOrder) ||
      /animateOrder:\d+/.test(element.id ?? ""),
  );
  return {
    kind: "excalidraw",
    sceneType: scene.type ?? null,
    version: scene.version ?? null,
    source: scene.source ?? null,
    elementCount: elements.length,
    elementTypes: counts,
    frameCount: frames.length,
    frames,
    animationOrderCount: ordered.length,
    textLabels: labels,
  };
}

function inspectLibrary(buffer) {
  const library = JSON.parse(buffer.toString("utf8"));
  const items = Array.isArray(library.libraryItems) ? library.libraryItems : [];
  return {
    kind: "excalidraw-library",
    version: library.version ?? null,
    itemCount: items.length,
    itemElementCounts: items.map((item) => item.elements?.length ?? 0),
  };
}

function authorityFor(filename) {
  if (
    filename.endsWith("Claude_Multi_Agent_Business_Guide.pdf") ||
    filename.endsWith("Claude_Codex_Broker_Addendum.docx") ||
    filename.endsWith("BEACON_COMPLETE_EXECUTION_PROMPT.md")
  ) {
    return "tier-1-authoritative-project-content";
  }
  if (
    filename.endsWith(".excalidraw") ||
    filename.endsWith(".excalidrawlib") ||
    filename.endsWith(".zip")
  ) {
    return "tier-1-source-evidence";
  }
  if (
    filename.endsWith("smart-home-architecture.html") ||
    filename.endsWith("v9-source.html") ||
    filename.endsWith("veslyn-proposal.html")
  ) {
    return "tier-3-visual-reference";
  }
  if (
    filename.endsWith("Claude_Multi_Agent_Business_Guide.txt") ||
    filename.endsWith("Claude_Codex_Broker_Addendum.txt")
  ) {
    return "tier-1-derived-text";
  }
  return "tier-3-derived-reference";
}

async function inspect(fileUrl) {
  const buffer = await readFile(fileUrl);
  const filename = fileUrl.pathname;
  const extension = extname(filename).toLowerCase();
  const info = await stat(fileUrl);
  let details = { kind: extension.slice(1) || "file" };
  if (extension === ".html") details = inspectHtml(buffer, filename);
  if (extension === ".excalidraw") details = inspectExcalidraw(buffer);
  if (extension === ".excalidrawlib") details = inspectLibrary(buffer);
  if (extension === ".txt") {
    const text = buffer.toString("utf8");
    details = {
      kind: "text",
      lineCount: text.split(/\r?\n/).length,
      wordCount: text.trim() ? text.trim().split(/\s+/).length : 0,
    };
  }
  return {
    path: relative(root.pathname, fileUrl.pathname),
    bytes: info.size,
    sha256: hash(buffer),
    authority: authorityFor(filename),
    ...details,
  };
}

const sourceFiles = [...(await walk(originalsRoot)), ...(await walk(extractedRoot))];
const records = await Promise.all(sourceFiles.map(inspect));
records.sort((a, b) => a.path.localeCompare(b.path));

const summary = {
  generatedAt: new Date().toISOString(),
  purpose:
    "Machine-readable assessment of safely imported source material. Original files remain unchanged.",
  records,
};

const markdown = [
  "# Source material assessment",
  "",
  `Generated: ${summary.generatedAt}`,
  "",
  "This assessment records repository-local copies and extracted material. It does not promote proposals to implemented state.",
  "",
  "| Source | Authority | Kind | Size | Inspection summary |",
  "|---|---|---|---:|---|",
  ...records.map((record) => {
    const detail =
      record.kind === "excalidraw"
        ? `${record.elementCount} elements; ${record.frameCount} frames; ${record.animationOrderCount} ordered elements`
        : record.kind === "html"
          ? `${record.headings.length} headings; ${record.inlineSvgElements} SVG; ${record.mermaidBlocks} Mermaid; ${record.interactiveControls} controls`
          : record.kind === "text"
            ? `${record.lineCount} lines; ${record.wordCount} words`
            : record.kind === "excalidraw-library"
              ? `${record.itemCount} library items`
              : "preserved and hashed";
    return `| \`${record.path}\` | ${record.authority} | ${record.kind} | ${record.bytes} | ${detail} |`;
  }),
  "",
  "## HTML structure",
  "",
  ...records
    .filter((record) => record.kind === "html")
    .flatMap((record) => [
      `### ${basename(record.path)}`,
      "",
      `Title: ${record.title}. Legacy “Veslyn” references: ${record.legacyVeslynReferences}.`,
      "",
      ...record.headings.map((heading) => `- ${heading.level.toUpperCase()}: ${heading.text}`),
      "",
    ]),
  "## Diagram labels",
  "",
  ...records
    .filter((record) => record.kind === "excalidraw")
    .flatMap((record) => [
      `### ${basename(record.path)}`,
      "",
      `Elements: ${record.elementCount}. Frames: ${record.frames.join(", ") || "none"}.`,
      "",
      ...record.textLabels.map((label) => `- ${label}`),
      "",
    ]),
];

await writeFile(outputJson, `${JSON.stringify(summary, null, 2)}\n`);
await writeFile(outputMarkdown, `${markdown.join("\n")}\n`);

console.log(`Inspected ${records.length} repository-local source files.`);
console.log(`Wrote ${relative(root.pathname, outputJson.pathname)} and ${relative(root.pathname, outputMarkdown.pathname)}.`);
