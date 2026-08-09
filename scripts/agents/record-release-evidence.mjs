#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ReleaseEvidenceEventSchema } from "../../src/modules/orchestration/domain/release-evidence.ts";

function valueAfter(flag, fallback = null) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1];
}

const type = valueAfter("--type");
const environment = valueAfter("--environment");
const commitSha = valueAfter("--commit");
const artifactSha256 = valueAfter("--artifact-sha256");
const releaseId = valueAfter("--release-id", commitSha ? `release-${commitSha}` : null);
const evidenceRef = valueAfter(
  "--evidence-ref",
  process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : "local-dry-run",
);
const rollbackFromArtifactSha256 = valueAfter("--rollback-from");
const event = ReleaseEvidenceEventSchema.parse({
  schemaVersion: 1,
  id: `${type}-${environment ?? "none"}-${process.env.GITHUB_RUN_ID ?? "local"}`,
  releaseId,
  type,
  recordedAt: new Date().toISOString(),
  commitSha,
  artifactSha256,
  environment: environment === "none" ? null : environment,
  passed: valueAfter("--passed", "true") === "true",
  externalApproval: valueAfter("--external-approval", "false") === "true",
  evidenceRef,
  rollbackFromArtifactSha256,
});
const root = "evidence/release";
await mkdir(root, { recursive: true });
const output = join(root, `${event.id}.json`);
await writeFile(output, `${JSON.stringify(event, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
console.log(`Recorded redacted ${event.type} evidence at ${output}.`);
