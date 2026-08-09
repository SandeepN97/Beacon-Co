#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { validateScenarioCatalog } from "../../src/modules/orchestration/evals/eval-runner.ts";

const catalog = JSON.parse(
  await readFile(
    new URL("../../agent-platform/evals/scenarios/phase-1.5.json", import.meta.url),
    "utf8",
  ),
);
const scenarios = validateScenarioCatalog(catalog);
console.log(`Validated ${scenarios.length} deterministic agent eval fixtures.`);
console.log("Live model measurements are not produced by this deterministic lane.");
