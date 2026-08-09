import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { AgentRoleSchema } from "../../src/modules/orchestration/domain/agent-run.ts";
import { ProviderIdSchema } from "../../src/modules/orchestration/domain/provider-run.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const manifest = parse(await readFile(resolve(root, "agent-platform/agent-contracts.yml"), "utf8"));
const schemas = [
  {
    name: "AgentRun",
    path: "agent-platform/telemetry/agent-run.schema.json",
    id: "https://beacon-co.local/schemas/agent-run.schema.json",
  },
  {
    name: "ProviderRun",
    path: "agent-platform/telemetry/provider-run.schema.json",
    id: "https://beacon-co.local/schemas/provider-run.schema.json",
  },
  {
    name: "EvalResult",
    path: "agent-platform/telemetry/eval-result.schema.json",
    id: "https://beacon.co/schemas/agent-platform/eval-result.schema.json",
  },
];
const errors = [];
const loaded = new Map();

for (const specification of schemas) {
  let schema;
  try {
    schema = JSON.parse(await readFile(resolve(root, specification.path), "utf8"));
  } catch (error) {
    errors.push(`${specification.path}: ${String(error)}`);
    continue;
  }
  loaded.set(specification.name, schema);
  if (schema.$schema !== "https://json-schema.org/draft/2020-12/schema") {
    errors.push(`${specification.path}: must use JSON Schema draft 2020-12.`);
  }
  if (schema.$id !== specification.id) {
    errors.push(`${specification.path}: unexpected $id.`);
  }
  if (schema.type !== "object" || schema.additionalProperties !== false) {
    errors.push(`${specification.path}: root must be a closed object schema.`);
  }
  if (schema.properties?.schemaVersion?.const !== 1) {
    errors.push(`${specification.path}: schemaVersion must be fixed at 1.`);
  }
  const propertyNames = Object.keys(schema.properties ?? {}).sort();
  const requiredNames = [...(schema.required ?? [])].sort();
  if (JSON.stringify(propertyNames) !== JSON.stringify(requiredNames)) {
    errors.push(`${specification.path}: every root property must be required.`);
  }
}

const expectedRoles = manifest.roles.map(({ id }) => id).sort();
const runtimeRoles = [...AgentRoleSchema.options].sort();
const jsonRoles = [...(loaded.get("AgentRun")?.properties?.agentRole?.enum ?? [])].sort();
if (JSON.stringify(runtimeRoles) !== JSON.stringify(expectedRoles)) {
  errors.push("Runtime AgentRole schema drifts from agent-platform/agent-contracts.yml.");
}
if (JSON.stringify(jsonRoles) !== JSON.stringify(expectedRoles)) {
  errors.push("AgentRun JSON schema role enum drifts from agent-platform/agent-contracts.yml.");
}

const expectedProviders = [...manifest.providers].sort();
const runtimeProviders = [...ProviderIdSchema.options].sort();
const jsonProviders = [...(loaded.get("ProviderRun")?.properties?.provider?.enum ?? [])].sort();
if (JSON.stringify(runtimeProviders) !== JSON.stringify(expectedProviders)) {
  errors.push("Runtime ProviderId schema drifts from the manifest provider catalog.");
}
if (JSON.stringify(jsonProviders) !== JSON.stringify(expectedProviders)) {
  errors.push("ProviderRun JSON schema provider enum drifts from the manifest provider catalog.");
}

if (errors.length) {
  console.error(`Telemetry schema validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  "Validated AgentRun/ProviderRun/EvalResult JSON schemas against runtime and manifest contracts.",
);
