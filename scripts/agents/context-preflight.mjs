#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { runContextPreflight } from "../../src/modules/orchestration/context/preflight.ts";
import { compilePromptContext } from "../../src/modules/orchestration/context/compiler.ts";

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? null : process.argv[index + 1];
}

const inputPath = valueAfter("--input");
if (!inputPath) {
  console.error("Usage: npm run context:preflight -- --input <preflight.json>");
  process.exitCode = 2;
} else {
  const input = JSON.parse(await readFile(inputPath, "utf8"));
  const contextPackage = runContextPreflight(input);
  const compilation = compilePromptContext({ contextPackage, objective: input.objective });
  process.stdout.write(`${JSON.stringify({ contextPackage, compilation }, null, 2)}\n`);
}
