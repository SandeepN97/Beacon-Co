#!/usr/bin/env node
// Advisory-only README currency check. Never fails the process: this script
// always exits 0. It reports whether the diff between --base and --head
// trips one of three narrow, concrete signals without also touching
// README.md in the same diff:
//   1. package.json's "scripts" object changed (keys added/removed/renamed,
//      or an existing script's command changed).
//   2. A whole module directory was added or removed one or two levels
//      under src/modules/ (e.g. a new src/modules/<module>/ root, or a new
//      bounded sub-area such as src/modules/orchestration/decision-os/ --
//      this repo's real convention places modules at either depth). Not
//      any file change inside an existing module directory.
//   3. A new ADR file landed under src/content/docs/decisions/ (excludes
//      adr-template.mdoc and index.mdoc, which aren't ADRs themselves).
// The calling workflow decides whether to post/update/remove a PR comment
// based on this script's JSON output; the workflow job itself is not a
// required status check, so this never blocks a merge.
import { execFileSync } from "node:child_process";

function valueAfter(flag, fallback = null) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1];
}

const base = valueAfter("--base", "origin/main");
const head = valueAfter("--head", "HEAD");

const git = (args) => execFileSync("git", args, { encoding: "utf8" });
const changedFiles = () =>
  git(["diff", "--name-status", `${base}...${head}`])
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [status, ...pathParts] = line.split("\t");
      return { status: status[0], path: pathParts[pathParts.length - 1] };
    });

const files = changedFiles();
const readmeTouched = files.some((file) => file.path === "README.md");

function readScripts(ref, path) {
  try {
    const raw = git(["show", `${ref}:${path}`]);
    return JSON.parse(raw).scripts ?? {};
  } catch {
    return {};
  }
}

const reasons = [];

const packageJsonChanged = files.some((file) => file.path === "package.json");
if (packageJsonChanged) {
  const baseScripts = readScripts(base, "package.json");
  const headScripts = readScripts(head, "package.json");
  const keys = new Set([...Object.keys(baseScripts), ...Object.keys(headScripts)]);
  const scriptsDiffer = [...keys].some((key) => baseScripts[key] !== headScripts[key]);
  if (scriptsDiffer) reasons.push("package.json's scripts object changed");
}

function moduleDirectories(ref) {
  try {
    return new Set(
      git(["ls-tree", "-d", "--name-only", "-r", ref, "src/modules/"])
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        // src/modules/<module>/ (3 segments) or src/modules/<module>/<subarea>/
        // (4 segments) -- this repo's two real depths for a bounded module.
        .filter((path) => {
          const depth = path.split("/").length;
          return depth === 3 || depth === 4;
        }),
    );
  } catch {
    return new Set();
  }
}
const baseModules = moduleDirectories(base);
const headModules = moduleDirectories(head);
for (const path of headModules) {
  if (!baseModules.has(path)) reasons.push(`new module added: ${path}/`);
}
for (const path of baseModules) {
  if (!headModules.has(path)) reasons.push(`module removed: ${path}/`);
}

const adrPattern = /^src\/content\/docs\/decisions\/\d{4}-.+\.mdoc$/;
const newAdrs = files
  .filter((file) => file.status === "A" && adrPattern.test(file.path))
  .filter((file) => !file.path.endsWith("/adr-template.mdoc"));
for (const file of newAdrs) reasons.push(`new ADR landed: ${file.path}`);

const triggered = reasons.length > 0 && !readmeTouched;
console.log(JSON.stringify({ triggered, readmeTouched, reasons }, null, 2));
process.exit(0);
