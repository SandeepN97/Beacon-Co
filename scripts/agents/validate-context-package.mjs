#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { validateContextPackage } from "../../src/modules/orchestration/domain/context-package.ts";
import { validatePromptCompilation } from "../../src/modules/orchestration/domain/prompt-compilation.ts";

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? null : process.argv[index + 1];
}

const inputPath = valueAfter("--input");
if (!inputPath) {
  console.error("Usage: npm run context:validate -- --input <preflight-output.json>");
  process.exitCode = 2;
} else {
  const input = JSON.parse(await readFile(inputPath, "utf8"));
  validateContextPackage(input.contextPackage);
  validatePromptCompilation(input.compilation);
  console.log("Validated ContextPackage and PromptCompilation records.");
}
