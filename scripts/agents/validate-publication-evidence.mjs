#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { PublicationEvidenceSchema } from "../../src/modules/orchestration/domain/publication-evidence.ts";
import { evaluatePublicationEvidence } from "../../src/modules/orchestration/publication/publication-policy.ts";

const index = process.argv.indexOf("--input");
if (index === -1 || !process.argv[index + 1]) {
  console.error("Usage: npm run publication:validate -- --input <publication-evidence.json>");
  process.exitCode = 2;
} else {
  const evidence = JSON.parse(await readFile(process.argv[index + 1], "utf8"));
  if (process.argv.includes("--schema-only")) {
    PublicationEvidenceSchema.parse(evidence);
    process.stdout.write(`${JSON.stringify({ schemaValid: true, authorizing: false }, null, 2)}\n`);
    process.exit(0);
  }
  const decision = evaluatePublicationEvidence(evidence);
  process.stdout.write(`${JSON.stringify(decision, null, 2)}\n`);
  if (!decision.ready) process.exitCode = 1;
}
