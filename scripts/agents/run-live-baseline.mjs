#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";
import { parse } from "yaml";
import { compilePromptContext } from "../../src/modules/orchestration/context/compiler.ts";
import { runContextPreflight } from "../../src/modules/orchestration/context/preflight.ts";
import { EvalResultSchema } from "../../src/modules/orchestration/domain/eval-result.ts";
import {
  LiveBaselineScenarioCatalogSchema,
  compileLiveBaselineAggregate,
} from "../../src/modules/orchestration/evals/live-baseline.ts";
import { CodexAdapter } from "../../src/modules/orchestration/providers/codex/codex-adapter.ts";
import { CodexCliTransport } from "../../src/modules/orchestration/providers/codex/codex-cli-transport.ts";
import { createLocalTelemetrySink } from "../../src/modules/orchestration/telemetry/sink.ts";
import { executeLiveWorkUnit } from "../../src/modules/orchestration/workflows/live-work-unit.ts";

const execFileAsync = promisify(execFile);

function valueAfter(flag, fallback = null) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1];
}

async function git(...args) {
  const { stdout } = await execFileAsync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  return stdout.trim();
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

function requireMeasuredUsage(usage) {
  const required = [
    "totalInputTokens",
    "cachedInputTokens",
    "uncachedInputTokens",
    "outputTokens",
    "totalTokens",
  ];
  for (const key of required) {
    if (!Number.isInteger(usage[key]) || usage[key] < 0) {
      throw new Error(`Live Codex evidence requires measured ${key}.`);
    }
  }
  return {
    totalInputTokens: usage.totalInputTokens,
    cachedInputTokens: usage.cachedInputTokens,
    uncachedInputTokens: usage.uncachedInputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
  };
}

const model = valueAfter("--model");
const outputPath = valueAfter("--output", ".beacon/telemetry/live-baseline.json");
const repetitionOverride = valueAfter("--repetitions");
if (!model || !outputPath) {
  console.error(
    "Usage: run-live-baseline --model <resolved-model-id> [--output <bounded-aggregate.json>] [--repetitions <count>]",
  );
  process.exitCode = 2;
} else {
  const trackedChanges = await git("status", "--porcelain", "--untracked-files=no");
  if (trackedChanges) {
    throw new Error("Live baseline execution requires a clean tracked candidate state.");
  }
  const candidateSha = await git("rev-parse", "HEAD");
  const [contracts, modelPolicy, scenarioInput] = await Promise.all([
    readFile("agent-platform/agent-contracts.yml", "utf8").then(parse),
    readFile("agent-platform/model-policy.yml", "utf8").then(parse),
    readFile("agent-platform/evals/live-baseline-scenarios.json", "utf8").then(JSON.parse),
  ]);
  const catalog = LiveBaselineScenarioCatalogSchema.parse(scenarioInput);
  const minimumScenarios = modelPolicy.minimumLiveScenarios;
  const minimumRepeatedRuns = modelPolicy.minimumRepeatedLiveRuns;
  const repetitions =
    repetitionOverride === null ? minimumRepeatedRuns : Number(repetitionOverride);
  if (!Number.isInteger(minimumScenarios) || minimumScenarios < 2) {
    throw new Error("Model policy must require at least two live scenarios.");
  }
  if (!Number.isInteger(minimumRepeatedRuns) || minimumRepeatedRuns < 3) {
    throw new Error("Model policy must require at least three repetitions per live scenario.");
  }
  if (!Number.isInteger(repetitions) || repetitions < minimumRepeatedRuns) {
    throw new Error(`Live baseline repetitions must be at least ${minimumRepeatedRuns}.`);
  }
  if (catalog.scenarios.length < minimumScenarios) {
    throw new Error(`Live baseline catalog requires at least ${minimumScenarios} scenarios.`);
  }

  const roles = new Map(contracts.roles.map((role) => [role.id, role]));
  const acceptedScenarioIds = new Set(contracts.liveEvalScenarioCatalog);
  for (const scenario of catalog.scenarios) {
    const role = roles.get(scenario.agentRole);
    if (!acceptedScenarioIds.has(scenario.id)) {
      throw new Error(`${scenario.id} is not in the accepted live scenario catalog.`);
    }
    if (!role?.liveEvalScenarios.includes(scenario.id)) {
      throw new Error(`${scenario.id} is not assigned to ${scenario.agentRole}.`);
    }
    if (!role.provider.eligible.includes("codex")) {
      throw new Error(`${scenario.agentRole} is not eligible for Codex execution.`);
    }
    if (scenario.riskClass !== "risk-0") {
      throw new Error(
        `${scenario.id} requires independent council evidence that this deterministic-only runner cannot supply.`,
      );
    }
  }

  const adapter = new CodexAdapter(new CodexCliTransport(process.cwd()));
  const telemetrySink = createLocalTelemetrySink(process.cwd(), "required");
  const runs = [];
  for (const scenario of catalog.scenarios) {
    const role = roles.get(scenario.agentRole);
    for (let repetition = 1; repetition <= repetitions; repetition += 1) {
      const workUnitId = `baseline-${scenario.id}-${randomUUID()}`;
      const agentRunId = `agent-${randomUUID()}`;
      const providerRunId = `provider-${randomUUID()}`;
      const evaluationId = `eval-${randomUUID()}`;
      const contextPackage = runContextPreflight({
        workUnitId,
        objective: scenario.objective,
        agentRole: role.id,
        riskClass: scenario.riskClass,
        contractSha256: role.sourceSha256,
        maxContextTokens: role.limits.maxContextTokens,
        allowedPaths: scenario.allowedPaths,
        allowedTools: [],
        acceptanceCriteria: scenario.acceptanceCriteria,
        searchTerms: scenario.searchTerms,
        candidates: [],
      });
      const compilation = compilePromptContext({
        contextPackage,
        objective: scenario.objective,
      });
      const result = await executeLiveWorkUnit(
        {
          agentRunId,
          providerRunId,
          workUnitId,
          agentRole: role.id,
          contractVersion: String(contracts.schemaVersion),
          contractSha256: role.sourceSha256,
          contextPackage,
          prompt: `${compilation.stablePrefix}\n\n${compilation.variableContext}`,
          compilationHash: compilation.compilationHash,
          resolvedModelId: model,
          requestedEffort: modelPolicy.roles[role.id].effort,
          maxOutputTokens: 64,
          maxTurns: 1,
        },
        {
          adapter,
          telemetrySink,
          validate: async (providerResult) => ({
            passed:
              providerResult.outputText.trim() === scenario.expectedOutput &&
              providerResult.toolEvidence.length === 0,
            evidenceId: `qa-${randomUUID()}`,
            summary: "Deterministic expected-output and no-tool validation completed.",
          }),
          review: async (providerResult) => ({
            passed:
              providerResult.outputText.trim() === scenario.expectedOutput &&
              providerResult.toolEvidence.length === 0,
            evidenceId: `review-${randomUUID()}`,
            summary: "Deterministic bounded-output policy verification completed.",
            provider: "deterministic-policy",
            sessionId: `deterministic-review-${randomUUID()}`,
            blockerCount:
              providerResult.outputText.trim() === scenario.expectedOutput &&
              providerResult.toolEvidence.length === 0
                ? 0
                : 1,
            majorCount: 0,
          }),
        },
      );
      const providerRun = result.providerResult.providerRun;
      const usage = requireMeasuredUsage(providerRun.usage);
      const passed = result.agentRun.outcome.finalState === "complete";
      const evaluation = EvalResultSchema.parse({
        schemaVersion: 1,
        evaluationId,
        scenarioId: scenario.id,
        lane: "live",
        attempt: repetition,
        status: passed ? "passed" : "failed",
        assertions: [
          {
            name: "provider-execution",
            passed: providerRun.status === "succeeded",
            evidence: `provider-run:${providerRun.id}`,
          },
          {
            name: "bounded-output",
            passed,
            evidence: result.agentRun.evidenceIds.join(","),
          },
        ],
        metrics: {
          taskSuccess: passed,
          unauthorizedActionCount: 0,
          scopeViolationCount: 0,
          tokens: usage.totalTokens,
          cachedTokens: usage.cachedInputTokens,
          turns: providerRun.turns,
          toolCalls: providerRun.toolCallCount,
          retries: providerRun.retryCount,
          latencyMs: providerRun.durationMs,
          costUsd: null,
          evidenceCompleteness: 1,
        },
        evidenceIds: result.agentRun.evidenceIds,
      });
      await writeJson(`.beacon/telemetry/live-eval-${evaluationId}.json`, evaluation);
      runs.push({
        schemaVersion: 1,
        scenarioId: scenario.id,
        repetition,
        agentRole: scenario.agentRole,
        riskClass: scenario.riskClass,
        provider: "codex",
        authenticationPath: "subscription-cli",
        resolvedModelId: providerRun.resolvedModelId,
        workUnitId,
        agentRunId,
        providerRunId,
        evaluationId,
        taskFingerprint: contextPackage.taskFingerprint,
        contextCompilationHash: compilation.compilationHash,
        outputSha256: createHash("sha256").update(result.providerResult.outputText).digest("hex"),
        status: result.agentRun.status,
        durationMs: providerRun.durationMs,
        contextBytes: contextPackage.contextBytes,
        estimatedContextTokens: contextPackage.estimatedInputTokens,
        usage,
        turns: providerRun.turns,
        toolCallCount: providerRun.toolCallCount,
        retryCount: providerRun.retryCount,
        fallbackUsed: providerRun.fallbackUsed,
        handoffUsed: providerRun.handoffUsed,
        qaDisposition: result.agentRun.outcome.qaPassed ? "passed" : "failed",
        reviewDisposition: result.agentRun.outcome.reviewDisposition,
        reviewMethod: "deterministic-policy",
        securityFailures: 0,
        scopeViolations: 0,
        evidenceCompleteness: 1,
      });
      const aggregate = compileLiveBaselineAggregate({
        runs,
        candidateSha,
        generatedAt: new Date().toISOString(),
        minimumScenarios,
        minimumRepeatedRuns,
      });
      await writeJson(outputPath, aggregate);
      console.log(
        JSON.stringify({
          scenarioId: scenario.id,
          repetition,
          workUnitId,
          providerRunId,
          evaluationId,
          resolvedModelId: providerRun.resolvedModelId,
          status: result.agentRun.outcome.finalState,
          totalTokens: usage.totalTokens,
          cachedInputTokens: usage.cachedInputTokens,
        }),
      );
    }
  }
  const aggregate = compileLiveBaselineAggregate({
    runs,
    candidateSha,
    generatedAt: new Date().toISOString(),
    minimumScenarios,
    minimumRepeatedRuns,
  });
  await writeJson(outputPath, aggregate);
  console.log(
    JSON.stringify({
      evidencePath: outputPath,
      candidateSha,
      provider: aggregate.provider,
      authenticationPath: aggregate.authenticationPath,
      scenarioCount: aggregate.benchmarkAggregate.scenarioCount,
      repeatedRunsPerScenario: aggregate.benchmarkAggregate.repeatedRunsPerScenario,
      totalRuns: aggregate.totalRuns,
      accepted: aggregate.accepted,
      acceptanceReasons: aggregate.acceptanceReasons,
    }),
  );
  if (!aggregate.accepted) process.exitCode = 1;
}
