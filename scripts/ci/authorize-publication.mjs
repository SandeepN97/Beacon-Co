#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { validatePublicationCandidate } from "../../src/modules/orchestration/domain/publication-readiness.ts";

function valueAfter(flag, fallback = null) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1];
}

const evidencePath = valueAfter("--evidence", "evidence/publication-readiness.json");
const candidateSha = valueAfter(
  "--candidate",
  execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
);
const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
const decision = validatePublicationCandidate(evidence, candidateSha);
if (!decision.ready) {
  console.error(
    `PUBLICATION DENIED\n${JSON.stringify(
      {
        candidateSha,
        failedGates: decision.failedGates,
        missingGates: decision.missingGates,
        reasons: decision.reasons,
      },
      null,
      2,
    )}`,
  );
  process.exit(1);
}
console.log(`PUBLICATION AUTHORIZED for ${candidateSha}.`);
