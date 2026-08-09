#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { validateReleaseEvidenceChain } from "../../src/modules/orchestration/publication/release-evidence-policy.ts";

const index = process.argv.indexOf("--input");
if (index === -1 || !process.argv[index + 1]) {
  console.error(
    "Usage: npm run release:evidence:validate -- --input <release-evidence-array.json>",
  );
  process.exitCode = 2;
} else {
  const events = JSON.parse(await readFile(process.argv[index + 1], "utf8"));
  const decision = validateReleaseEvidenceChain(events);
  process.stdout.write(`${JSON.stringify(decision, null, 2)}\n`);
  if (!decision.complete) process.exitCode = 1;
}
