import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createCiTelemetrySink,
  createLocalTelemetrySink,
} from "../../src/modules/orchestration/telemetry/sink.ts";

function parseArguments(arguments_) {
  const options = { kind: null, input: null, sink: "local", required: false };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--required") options.required = true;
    else if (argument === "--kind") options.kind = arguments_[++index] ?? null;
    else if (argument === "--input") options.input = arguments_[++index] ?? null;
    else if (argument === "--sink") options.sink = arguments_[++index] ?? null;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!["agent-run", "provider-run"].includes(options.kind)) {
    throw new Error("--kind must be agent-run or provider-run.");
  }
  if (!options.input) throw new Error("--input <JSON file> is required.");
  if (!["local", "ci"].includes(options.sink)) throw new Error("--sink must be local or ci.");
  return options;
}

const options = parseArguments(process.argv.slice(2));
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const inputPath = resolve(process.cwd(), options.input);
const input = JSON.parse(await readFile(inputPath, "utf8"));
const mode = options.required ? "required" : "best-effort";
const sink =
  options.sink === "ci"
    ? createCiTelemetrySink(repositoryRoot, mode)
    : createLocalTelemetrySink(repositoryRoot, mode);
const result = await sink.append(options.kind, input);

if (!result.persisted) {
  console.warn(
    `Telemetry was not persisted (${result.errorCode}); the underlying agent result remains valid in best-effort mode.`,
  );
} else {
  console.log(`Recorded ${result.kind} ${result.recordId} to ${result.path}.`);
}
