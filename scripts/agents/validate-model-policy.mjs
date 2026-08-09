#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { parse } from "yaml";

const modelPolicy = parse(await readFile("agent-platform/model-policy.yml", "utf8"));
const contracts = parse(await readFile("agent-platform/agent-contracts.yml", "utf8"));
const contextPolicy = parse(await readFile("agent-platform/context-policy.yml", "utf8"));
const baseline = JSON.parse(
  await readFile("agent-platform/baselines/deterministic-fixtures-v1.json", "utf8"),
);
const errors = [];
if (modelPolicy.schemaVersion !== 1) errors.push("model-policy schemaVersion must be 1.");
if (modelPolicy.learnedRouterAllowed !== false)
  errors.push("Phase 1.5 does not permit a learned router.");
for (const role of contracts.roles) {
  const configured = modelPolicy.roles?.[role.id];
  if (!configured) {
    errors.push(`${role.id}: missing model policy.`);
    continue;
  }
  for (const key of ["maxTurns", "maxContextTokens", "maxOutputTokens"]) {
    if (configured[key] !== role.limits[key])
      errors.push(`${role.id}: ${key} drifted from the unevaluated contract baseline.`);
  }
  if (configured.defaultProvider !== role.provider.default)
    errors.push(`${role.id}: default provider drifted from the contract baseline.`);
  if (contextPolicy.roleBudgets?.[role.id] !== role.limits.maxContextTokens)
    errors.push(`${role.id}: context budget drifted from the contract baseline.`);
}
if (!baseline.liveMeasurementsAvailable && modelPolicy.acceptedTuning.length > 0)
  errors.push("Tuning cannot be accepted before a live benchmark baseline exists.");
if (errors.length > 0) {
  console.error("Model policy validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Validated frozen model policy for ${contracts.roles.length} roles; no unevidenced tuning accepted.`,
  );
}
