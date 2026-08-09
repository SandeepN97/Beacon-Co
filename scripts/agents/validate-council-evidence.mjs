#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { adjudicateCouncil } from "../../src/modules/orchestration/policy/council-policy.ts";

const index = process.argv.indexOf("--input");
if (index === -1 || !process.argv[index + 1]) {
  console.error("Usage: npm run council:validate -- --input <council-evidence.json>");
  process.exitCode = 2;
} else {
  const evidence = JSON.parse(await readFile(process.argv[index + 1], "utf8"));
  const decision = adjudicateCouncil(evidence);
  process.stdout.write(`${JSON.stringify(decision, null, 2)}\n`);
  if (decision.disposition !== "approved") process.exitCode = 1;
}
