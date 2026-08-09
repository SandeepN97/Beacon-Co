#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { parse } from "yaml";
import { evaluatePhase15Completion } from "../../src/modules/orchestration/completion/completion-audit.ts";
import { validatePublicationCandidate } from "../../src/modules/orchestration/domain/publication-readiness.ts";

function valueAfter(flag, fallback = null) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1];
}

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
const candidateSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const publicationEvidencePath = valueAfter(
  "--publication-evidence",
  "evidence/publication-readiness.json",
);
let publicationEvidence = null;
try {
  publicationEvidence = JSON.parse(await readFile(publicationEvidencePath, "utf8"));
} catch {
  publicationEvidence = null;
}
const publicationDecision = publicationEvidence
  ? validatePublicationCandidate(publicationEvidence, candidateSha)
  : { ready: false };
const publicationGateStatus = (name) =>
  publicationEvidence?.gates?.some((gate) => gate.name === name && gate.status === "passed") ===
  true;
const observedExternal = observation.evidenceGates ?? {};

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
  publication: {
    "authoritative-prepublication-check": publicationDecision.ready === true,
    "deterministic-pr-metadata":
      publicationGateStatus("deterministic-pr-metadata-render") &&
      publicationGateStatus("pr-metadata-policy"),
    "publication-scope": publicationGateStatus("publication-scope"),
    "candidate-diff-validation": publicationGateStatus("candidate-diff-validation"),
  },
  external: {
    "representative-live-provider-run": observedExternal.representativeLiveProviderRun === true,
    "repeated-live-eval-baseline": observedExternal.repeatedLiveEvalBaseline === true,
    "agent-platform-required-check":
      observedExternal.agentPlatformRequiredCheck === true ||
      observation.ruleset.agentPlatformCheckRequired === true,
    "non-bypassable-external-production-approval":
      observation.environments.production.requiredReviewers > 0 &&
      observation.environments.production.adminsCanBypass === false,
    "verified-build-attestation": observedExternal.verifiedBuildAttestation === true,
    "staging-promotion-and-verification": observedExternal.stagingPromotionAndVerification === true,
    "production-promotion-and-verification":
      observedExternal.productionPromotionAndVerification === true,
    "known-good-rollback-drill": observedExternal.knownGoodRollbackDrill === true,
  },
};
const result = evaluatePhase15Completion(state);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
const localOnly = process.argv.includes("--local-only");
if (localOnly ? !result.localReady : result.status !== "complete-frozen") process.exitCode = 1;
