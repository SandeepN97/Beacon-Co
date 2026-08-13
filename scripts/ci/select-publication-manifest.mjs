#!/usr/bin/env node
// Picks which publication manifest ci:prepublish should use for a given
// candidate diff. Tries each --candidate manifest in order and selects the
// first one whose allowedPathPrefixes covers every changed path; falls back
// to the last candidate (the repo's existing default) if none fully match.
// Reuses this repo's existing PublicationManifestSchema/pathMatchesPublicationScope
// rather than reimplementing prefix matching -- see
// src/modules/orchestration/domain/publication-manifest.ts.
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
function allValuesAfter(flag) {
  const values = [];
  for (let index = process.argv.indexOf(flag); index !== -1;) {
    values.push(process.argv[index + 1]);
    index = process.argv.indexOf(flag, index + 1);
  }
  return values;
}

const base = valueAfter("--base", "origin/main");
const head = valueAfter("--head", "HEAD");
const candidates = allValuesAfter("--candidate");
if (candidates.length === 0) {
  console.error(
    "Usage: select-publication-manifest --candidate <path> [--candidate <path> ...] [--base <ref>] [--head <ref>]",
  );
  process.exit(2);
}

const changedPaths = execFileSync("git", ["diff", "--name-only", `${base}...${head}`], {
  encoding: "utf8",
})
  .split("\n")
  .map((path) => path.trim())
  .filter(Boolean);

let selected = candidates[candidates.length - 1];
for (const candidatePath of candidates) {
  const manifest = PublicationManifestSchema.parse(
    JSON.parse(await readFile(candidatePath, "utf8")),
  );
  const allMatch =
    changedPaths.length > 0 &&
    changedPaths.every((path) => pathMatchesPublicationScope(path, manifest));
  if (allMatch) {
    selected = candidatePath;
    break;
  }
}

console.log(selected);
