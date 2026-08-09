#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import {
  PublicationManifestSchema,
  pathMatchesPublicationScope,
} from "../../src/modules/orchestration/domain/publication-manifest.ts";

function valueAfter(flag, fallback = null) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1];
}

const manifestPath = valueAfter("--manifest");
const base = valueAfter("--base", "origin/main");
const head = valueAfter("--head", "HEAD");
if (!manifestPath) {
  console.error(
    "Usage: validate-publication-scope --manifest <path> [--base <ref>] [--head <ref>]",
  );
  process.exit(2);
}
const manifest = PublicationManifestSchema.parse(JSON.parse(await readFile(manifestPath, "utf8")));
const readPaths = (args) =>
  execFileSync("git", args, { encoding: "utf8" })
    .split("\n")
    .map((path) => path.trim())
    .filter(Boolean);
const paths = readPaths(["diff", "--name-only", `${base}...${head}`]);
if (!process.argv.includes("--committed-only")) {
  paths.push(
    ...readPaths(["diff", "--name-only", "HEAD"]),
    ...readPaths(["diff", "--name-only", "--cached"]),
    ...readPaths(["ls-files", "--others", "--exclude-standard"]),
  );
}
const uniquePaths = [...new Set(paths)].sort();
const outsideScope = uniquePaths.filter((path) => !pathMatchesPublicationScope(path, manifest));
if (uniquePaths.length === 0) {
  console.error("Publication scope failed: candidate has no changed paths.");
  process.exit(1);
}
if (outsideScope.length > 0) {
  console.error("Publication scope failed; paths outside the manifest scope:");
  for (const path of outsideScope) console.error(`- ${path}`);
  process.exit(1);
}
console.log(`Publication scope passed for ${uniquePaths.length} changed paths.`);
