#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import { parse } from "yaml";
import { evaluatePhase15Completion } from "../../src/modules/orchestration/completion/completion-audit.ts";

const requiredFiles = [
  "agent-platform/agent-contracts.yml",
  "agent-platform/context-policy.yml",
  "agent-platform/model-policy.yml",
  "agent-platform/risk-policy.yml",
  "agent-platform/telemetry/agent-run.schema.json",
  "agent-platform/telemetry/provider-run.schema.json",
  "agent-platform/telemetry/eval-result.schema.json",
  "src/modules/orchestration/context/preflight.ts",
  "src/modules/orchestration/context/compiler.ts",
  "src/modules/orchestration/policy/tool-policy.ts",
  "src/modules/orchestration/policy/council-policy.ts",
  "src/modules/orchestration/providers/claude/claude-adapter.ts",
  "src/modules/orchestration/providers/codex/codex-adapter.ts",
  ".github/workflows/agent-platform-checks.yml",
  ".github/workflows/live-agent-evals.yml",
  ".github/workflows/rollback-production.yml",
];
const fileResults = await Promise.all(
  requiredFiles.map(async (path) => {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }),
);
const manifest = parse(await readFile("agent-platform/agent-contracts.yml", "utf8"));
const observation = JSON.parse(
  await readFile("agent-platform/baselines/external-controls-observation-2026-08-09.json", "utf8"),
);
const localReady =
  fileResults.every(Boolean) && manifest.roleSet?.count === 8 && manifest.roles?.length === 8;

const state = {
  local: {
    "contracts-and-governance": localReady,
    "telemetry-foundation": localReady,
    "context-preflight-compiler": localReady,
    "deterministic-eval-harness": localReady,
    "tool-policy-gateway": localReady,
    "provider-adapter-contracts": localReady,
    "risk-council-engine": localReady,
    "evidence-gated-tuning": localReady,
    "publication-evidence-gate": localReady,
    "release-provenance-workflows": localReady,
    "scope-control": true,
  },
  external: {
    "representative-live-provider-run": false,
    "repeated-live-eval-baseline": false,
    "agent-platform-required-check": observation.ruleset.agentPlatformCheckRequired === true,
    "non-bypassable-external-production-approval":
      observation.environments.production.requiredReviewers > 0 &&
      observation.environments.production.adminsCanBypass === false,
    "verified-build-attestation": false,
    "staging-promotion-and-verification": false,
    "production-promotion-and-verification": false,
    "known-good-rollback-drill": false,
  },
};
const result = evaluatePhase15Completion(state);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
const localOnly = process.argv.includes("--local-only");
if (localOnly ? !result.localReady : result.status !== "complete-frozen") process.exitCode = 1;
