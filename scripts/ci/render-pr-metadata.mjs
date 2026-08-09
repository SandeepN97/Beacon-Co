#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  PublicationManifestSchema,
  renderPullRequestBody,
} from "../../src/modules/orchestration/domain/publication-manifest.ts";

function valueAfter(flag, fallback = null) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1];
}

const manifestPath = valueAfter("--manifest");
const titleOutput = valueAfter("--title-output", "evidence/publication/pr-title.txt");
const bodyOutput = valueAfter("--body-output", "evidence/publication/pr-body.md");
const readinessPath = valueAfter("--readiness");
if (!manifestPath) {
  console.error("Usage: render-pr-metadata --manifest <path> [--readiness <path>]");
  process.exit(2);
}

const manifest = PublicationManifestSchema.parse(JSON.parse(await readFile(manifestPath, "utf8")));
const machineEvidence = [];
if (readinessPath) {
  const readiness = JSON.parse(await readFile(readinessPath, "utf8"));
  machineEvidence.push(
    `npm run ci:prepublish — ${readiness.publicationReady === true ? "passed" : "failed"} for candidate ${String(readiness.candidateSha)}.`,
  );
}
await Promise.all([
  mkdir(dirname(titleOutput), { recursive: true }),
  mkdir(dirname(bodyOutput), { recursive: true }),
]);
await writeFile(titleOutput, `${manifest.title}\n`, { encoding: "utf8", mode: 0o600 });
await writeFile(bodyOutput, renderPullRequestBody(manifest, machineEvidence), {
  encoding: "utf8",
  mode: 0o600,
});
console.log(`Rendered deterministic PR metadata from ${manifestPath}.`);
