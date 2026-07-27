import { readFile } from "node:fs/promises";

const lockfile = JSON.parse(await readFile("package-lock.json", "utf8"));
const denied = new Set(["AGPL-1.0", "AGPL-3.0", "SSPL-1.0"]);
const unknown = [];
const violations = [];

for (const [path, entry] of Object.entries(lockfile.packages ?? {})) {
  if (!path || entry.link) continue;
  const license = entry.license;
  if (!license) {
    unknown.push(path.replace(/^node_modules\//, ""));
    continue;
  }
  const identifiers = String(license)
    .split(/\s+(?:OR|AND)\s+|[()]/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (identifiers.some((identifier) => denied.has(identifier))) {
    violations.push(`${path.replace(/^node_modules\//, "")}: ${license}`);
  }
}

if (violations.length) {
  console.error("Denied dependency licenses found:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(
  `License policy passed. ${unknown.length} transitive package records have no SPDX license in the lockfile and remain an evidence limitation.`,
);
