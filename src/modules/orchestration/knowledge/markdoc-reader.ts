import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import type { DocumentIndexEntry } from "./document-index";

function parseScalar(value: string): string | string[] | number | boolean {
  const clean = value.trim();
  if (clean.startsWith("[") && clean.endsWith("]")) {
    return clean
      .slice(1, -1)
      .split(",")
      .map((item) => item.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }
  if (/^\d+$/.test(clean)) return Number(clean);
  if (clean === "true" || clean === "false") return clean === "true";
  return clean.replace(/^["']|["']$/g, "");
}

export function parseMarkdocSource(source: string) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: source };
  const data: Record<string, unknown> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 1) continue;
    data[line.slice(0, separator).trim()] = parseScalar(line.slice(separator + 1));
  }
  return { data, body: match[2] };
}

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const child = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(child)));
    else if (extname(entry.name) === ".mdoc") files.push(child);
  }
  return files;
}

export async function readMarkdocDocuments(
  contentRoot: string,
): Promise<DocumentIndexEntry[]> {
  const files = await walk(contentRoot);
  return Promise.all(
    files.map(async (file) => {
      const source = await readFile(file, "utf8");
      const { data, body } = parseMarkdocSource(source);
      const id = relative(contentRoot, file).replace(/\.mdoc$/, "").replaceAll("\\", "/");
      return {
        id,
        title: String(data.title ?? id),
        description: String(data.description ?? ""),
        section: String(data.section ?? id.split("/")[0]),
        status: (data.status ?? "draft") as DocumentIndexEntry["status"],
        sourceFiles: Array.isArray(data.sourceFiles) ? data.sourceFiles.map(String) : [],
        relatedAdrs: Array.isArray(data.relatedAdrs) ? data.relatedAdrs.map(String) : [],
        tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
        body,
      };
    }),
  );
}
