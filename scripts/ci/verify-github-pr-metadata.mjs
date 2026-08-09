#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { validatePullRequestPolicy } from "../../src/modules/orchestration/publication/pr-policy.ts";

function valueAfter(flag, fallback = null) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1];
}

const pr = valueAfter("--pr");
const repository = valueAfter("--repo", process.env.GITHUB_REPOSITORY);
const output = valueAfter("--output", "evidence/publication/github-pr-metadata.json");
if (!pr || !repository) {
  console.error("Usage: verify-github-pr-metadata --pr <number> --repo <owner/name>");
  process.exit(2);
}

const observed = JSON.parse(
  execFileSync(
    "gh",
    ["pr", "view", pr, "--repo", repository, "--json", "number,title,body,headRefOid,url"],
    {
      encoding: "utf8",
    },
  ),
);
const decision = validatePullRequestPolicy({ title: observed.title, body: observed.body });
const record = {
  schemaVersion: 1,
  repository,
  prNumber: observed.number,
  headSha: observed.headRefOid,
  url: observed.url,
  observedAt: new Date().toISOString(),
  titleSha256: createHash("sha256").update(observed.title).digest("hex"),
  bodySha256: createHash("sha256").update(observed.body).digest("hex"),
  metadataValid: decision.valid,
  errors: decision.errors,
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
if (!decision.valid) {
  console.error("GitHub PR metadata verification failed:");
  for (const error of decision.errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`GitHub PR #${observed.number} metadata passed the canonical policy.`);
