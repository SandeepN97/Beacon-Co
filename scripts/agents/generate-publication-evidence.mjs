#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { REQUIRED_PR_CHECKS } from "../../src/modules/orchestration/publication/publication-policy.ts";

function valueAfter(flag, fallback = null) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1];
}

const baseSha = valueAfter("--base");
const headSha = valueAfter("--head", process.env.GITHUB_SHA);
const output = valueAfter("--output", "evidence/publication-evidence.json");
if (!baseSha || !headSha) {
  console.error(
    "Usage: generate-publication-evidence --base <git-sha> --head <git-sha> [--output <path>]",
  );
  process.exitCode = 2;
} else {
  const diff = execFileSync("git", ["diff", "--binary", baseSha, headSha], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  const record = {
    schemaVersion: 1,
    repository: process.env.GITHUB_REPOSITORY ?? "local/Beacon-Co",
    baseSha,
    headSha,
    diffSha256: createHash("sha256").update(diff).digest("hex"),
    generatedAt: new Date().toISOString(),
    author: null,
    qa: null,
    reviews: [],
    requiredChecks: REQUIRED_PR_CHECKS.map((name) => ({ name, status: "pending" })),
    externalAuthorityRecorded: false,
    publicationReady: false,
  };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(record, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  console.log(`Generated non-authorizing publication evidence for diff ${record.diffSha256}.`);
}
