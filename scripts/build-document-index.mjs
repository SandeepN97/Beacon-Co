import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const contentRoot = join(root, "src", "content", "docs");
const publicOutput = join(root, "public", "search-index.json");
const catalogOutput = join(root, "src", "data", "document-catalog.json");

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(child)));
    else if (extname(entry.name) === ".mdoc") files.push(child);
  }
  return files;
}

function parseValue(value) {
  const trimmed = value.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed.replace(/^["']|["']$/g, "");
  }
}

function parseSource(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error("Markdoc source is missing frontmatter.");
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 1) continue;
    data[line.slice(0, separator).trim()] = parseValue(line.slice(separator + 1));
  }
  return { data, body: match[2] };
}

function plainText(body) {
  return body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/{%[\s\S]*?%}/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`|~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const files = await walk(contentRoot);
const catalog = await Promise.all(
  files.map(async (file) => {
    const source = await readFile(file, "utf8");
    const { data, body } = parseSource(source);
    const id = relative(contentRoot, file).replace(/\.mdoc$/, "").replaceAll("\\", "/");
    return {
      id,
      title: data.title,
      description: data.description,
      section: data.section,
      status: data.status,
      sourceFiles: data.sourceFiles,
      relatedAdrs: data.relatedAdrs,
      tags: data.tags,
      body: plainText(body),
    };
  }),
);
catalog.sort((left, right) => left.id.localeCompare(right.id));

const searchIndex = catalog.map((document) => ({
  id: document.id,
  title: document.title,
  description: document.description,
  section: document.section,
  status: document.status,
  href: document.id === "index" ? "/docs/" : `/docs/${document.id}/`,
  searchText: `${document.title} ${document.description} ${document.section} ${document.tags.join(" ")} ${document.body}`.toLowerCase(),
}));

await mkdir(dirname(publicOutput), { recursive: true });
await mkdir(dirname(catalogOutput), { recursive: true });
await writeFile(publicOutput, `${JSON.stringify(searchIndex, null, 2)}\n`);
await writeFile(catalogOutput, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Indexed ${catalog.length} Markdoc pages for retrieval and client-side search.`);
