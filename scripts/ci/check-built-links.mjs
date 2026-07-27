import { access, readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dist = join(root, "dist");
const errors = [];

async function walk(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(child)));
    else if (entry.name.endsWith(".html")) files.push(child);
  }
  return files;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

for (const file of await walk(dist)) {
  const html = await readFile(file, "utf8");
  for (const match of html.matchAll(/\b(?:href|src)="(\/[^"#?]+)[^"]*"/g)) {
    const target = match[1];
    if (target.startsWith("/api/")) continue;
    const path = join(dist, target);
    if (
      !(await exists(path)) &&
      !(await exists(`${path}.html`)) &&
      !(await exists(join(path, "index.html")))
    ) {
      errors.push(`${relative(dist, file)} -> ${target}`);
    }
  }
}

if (errors.length) {
  console.error("Broken built links or assets:");
  for (const error of [...new Set(errors)]) console.error(`- ${error}`);
  process.exit(1);
}
console.log("Built-link validation passed.");
