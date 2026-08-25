#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { parse } from "yaml";
import { evaluatePhase15Completion } from "../../src/modules/orchestration/completion/completion-audit.ts";
import { validatePublicationCandidate } from "../../src/modules/orchestration/domain/publication-readiness.ts";
import {
  LiveBaselineAggregateSchema,
  compileLiveBaselineAggregate,
} from "../../src/modules/orchestration/evals/live-baseline.ts";

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
  "agent-platform/telemetry/execution-budget-ledger.schema.json",
  "agent-platform/telemetry/eval-result.schema.json",
  "src/modules/orchestration/context/preflight.ts",
  "src/modules/orchestration/context/compiler.ts",
  "src/modules/orchestration/policy/tool-policy.ts",
  "src/modules/orchestration/policy/council-policy.ts",
  "src/modules/orchestration/providers/claude/claude-adapter.ts",
  "src/modules/orchestration/providers/codex/codex-adapter.ts",
  "src/modules/orchestration/execution-budget/execution-budget.ts",
  "tests/orchestration/execution-budget.test.ts",
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
const modelPolicy = parse(await readFile("agent-platform/model-policy.yml", "utf8"));
const executionBudgetConformance = JSON.parse(
  await readFile("agent-platform/baselines/execution-budget-conformance-2026-08-25.json", "utf8"),
);
const executionBudgetConformanceValid =
  executionBudgetConformance.authority === "ADR-0023" &&
  executionBudgetConformance.correction === "PHASE15_BUDGET_SEMANTICS_GAP" &&
  executionBudgetConformance.evidenceBinding === "candidate-tree-via-ci-prepublish" &&
  executionBudgetConformance.implementation?.executionBudgetLineage === true &&
  executionBudgetConformance.implementation?.executionBudgetLedger === true &&
  executionBudgetConformance.implementation?.atomicAdmission === true &&
  executionBudgetConformance.implementation?.durableFailureEvidence === true &&
  executionBudgetConformance.providerVerdicts?.claudeDirectHttp === "COMPLIANT" &&
  executionBudgetConformance.providerVerdicts?.codexDirectHttp === "COMPLIANT" &&
  executionBudgetConformance.providerVerdicts?.codexCli === "NONCOMPLIANT_FAIL_CLOSED" &&
  executionBudgetConformance.providerVerdicts?.openCodeHarness ===
    "UNCHANGED_NONEXECUTABLE_FAIL_CLOSED";
const repeatedBaselinePath = "agent-platform/baselines/live-codex-multiscenario-2026-08-09.json";
const repeatedBaselineValid = await (async () => {
  try {
    const recordedBaseline = LiveBaselineAggregateSchema.parse(
      JSON.parse(await readFile(repeatedBaselinePath, "utf8")),
    );
    const compiledBaseline = compileLiveBaselineAggregate({
      runs: recordedBaseline.runs,
      candidateSha: recordedBaseline.candidateSha,
      generatedAt: recordedBaseline.generatedAt,
      minimumScenarios: modelPolicy.minimumLiveScenarios,
      minimumRepeatedRuns: modelPolicy.minimumRepeatedLiveRuns,
    });
    const references = observation.evidenceReferences?.repeatedLiveEvalBaseline ?? [];
    return (
      recordedBaseline.accepted === true &&
      compiledBaseline.accepted === true &&
      recordedBaseline.totalRuns === compiledBaseline.totalRuns &&
      JSON.stringify(recordedBaseline.scenarioIds) ===
        JSON.stringify(compiledBaseline.scenarioIds) &&
      JSON.stringify(recordedBaseline.benchmarkAggregate) ===
        JSON.stringify(compiledBaseline.benchmarkAggregate) &&
      references.includes(repeatedBaselinePath) &&
      references.includes(`candidate:${recordedBaseline.candidateSha}`)
    );
  } catch {
    return false;
  }
})();
const localReady =
  fileResults.every(Boolean) && manifest.roleSet?.count === 8 && manifest.roles?.length === 8;
const candidateSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const candidateTree = execFileSync("git", ["rev-parse", "HEAD^{tree}"], {
  encoding: "utf8",
}).trim();
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
  ? validatePublicationCandidate(publicationEvidence, candidateSha, candidateTree)
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
    "execution-budget-conformance": localReady && executionBudgetConformanceValid,
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
    "repeated-live-eval-baseline":
      observedExternal.repeatedLiveEvalBaseline === true && repeatedBaselineValid,
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
