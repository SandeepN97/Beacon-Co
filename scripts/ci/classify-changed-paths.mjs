#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { classifyChangedPaths } from "../../src/modules/orchestration/publication/changed-paths.ts";

function valueAfter(flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1];
}

const base = valueAfter("--base", "origin/main");
const head = valueAfter("--head", "HEAD");
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
process.stdout.write(`${JSON.stringify(classifyChangedPaths(paths), null, 2)}\n`);
