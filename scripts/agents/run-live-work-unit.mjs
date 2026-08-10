#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { parse } from "yaml";
import { readFile } from "node:fs/promises";
import { compilePromptContext } from "../../src/modules/orchestration/context/compiler.ts";
import { runContextPreflight } from "../../src/modules/orchestration/context/preflight.ts";
import { EvalResultSchema } from "../../src/modules/orchestration/domain/eval-result.ts";
import { ClaudeAdapter } from "../../src/modules/orchestration/providers/claude/claude-adapter.ts";
import { CodexAdapter } from "../../src/modules/orchestration/providers/codex/codex-adapter.ts";
import { CodexCliTransport } from "../../src/modules/orchestration/providers/codex/codex-cli-transport.ts";
import { HttpProviderTransport } from "../../src/modules/orchestration/providers/http-provider-transport.ts";
import {
  createCiTelemetrySink,
  createLocalTelemetrySink,
} from "../../src/modules/orchestration/telemetry/sink.ts";
import { executeLiveWorkUnit } from "../../src/modules/orchestration/workflows/live-work-unit.ts";

function valueAfter(flag, fallback = null) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1];
}

const provider = valueAfter("--provider");
const model = valueAfter("--model");
const sinkMode = valueAfter("--sink", "local");
const transportMode = valueAfter("--transport", "http");
if (
  !["claude", "codex"].includes(provider) ||
  !model ||
  !["local", "ci"].includes(sinkMode) ||
  !["http", "cli"].includes(transportMode) ||
  (transportMode === "cli" && provider !== "codex")
) {
  console.error(
    "Usage: run-live-work-unit --provider claude|codex --model <resolved-model-id> [--sink local|ci] [--transport http|cli]",
  );
  process.exitCode = 2;
} else {
  const manifest = parse(await readFile("agent-platform/agent-contracts.yml", "utf8"));
  const role = manifest.roles.find((candidate) => candidate.id === "codebase-researcher");
  const workUnitId = `live-smoke-${randomUUID()}`;
  const objective =
    "Return exactly BEACON_LIVE_OK. Do not call tools, inspect files, or include other text.";
  const contextPackage = runContextPreflight({
    workUnitId,
    objective,
    agentRole: role.id,
    riskClass: "risk-0",
    contractSha256: role.sourceSha256,
    maxContextTokens: role.limits.maxContextTokens,
    allowedPaths: ["src"],
    allowedTools: [],
    acceptanceCriteria: ["Output is exactly BEACON_LIVE_OK", "No tool call is requested"],
    searchTerms: ["BEACON_LIVE_OK"],
    candidates: [],
  });
  const compilation = compilePromptContext({ contextPackage, objective });
  const transport =
    transportMode === "cli"
      ? new CodexCliTransport(process.cwd())
      : new HttpProviderTransport({
          anthropicApiKey: process.env.ANTHROPIC_API_KEY,
          openaiApiKey: process.env.OPENAI_API_KEY,
        });
  const adapter =
    provider === "claude" ? new ClaudeAdapter(transport) : new CodexAdapter(transport);
  const root = process.cwd();
  const telemetrySink =
    sinkMode === "ci"
      ? createCiTelemetrySink(root, "required")
      : createLocalTelemetrySink(root, "required");
  const result = await executeLiveWorkUnit(
    {
      agentRunId: `agent-${randomUUID()}`,
      providerRunId: `provider-${randomUUID()}`,
      workUnitId,
      agentRole: role.id,
      contractVersion: String(manifest.schemaVersion),
      contractSha256: role.sourceSha256,
      contextPackage,
      prompt: `${compilation.stablePrefix}\n\n${compilation.variableContext}`,
      compilationHash: compilation.compilationHash,
      resolvedModelId: model,
      requestedEffort: "low",
      maxOutputTokens: 32,
      maxTurns: 1,
    },
    {
      adapter,
      telemetrySink,
      validate: async (providerResult) => ({
        passed:
          providerResult.outputText.trim() === "BEACON_LIVE_OK" &&
          providerResult.toolEvidence.length === 0,
        evidenceId: `qa-${randomUUID()}`,
        summary: "Deterministic exact-output and no-tool validation completed.",
      }),
      review: async (providerResult) => ({
        passed: providerResult.outputText.trim() === "BEACON_LIVE_OK",
        evidenceId: `review-${randomUUID()}`,
        summary: "Deterministic bounded-output policy verification completed.",
        provider: "deterministic-policy",
        sessionId: `deterministic-review-${randomUUID()}`,
        blockerCount: providerResult.outputText.trim() === "BEACON_LIVE_OK" ? 0 : 1,
        majorCount: 0,
      }),
    },
  );
  const usage = result.providerResult.providerRun.usage;
  const evaluation = EvalResultSchema.parse({
    schemaVersion: 1,
    evaluationId: `eval-${randomUUID()}`,
    scenarioId: "provider-live-smoke",
    lane: "live",
    attempt: 1,
    status: result.agentRun.outcome.finalState === "complete" ? "passed" : "failed",
    assertions: [
      {
        name: "provider-live",
        passed: result.providerResult.providerRun.status === "succeeded",
        evidence: `provider-run:${result.providerResult.providerRun.id}`,
      },
      {
        name: "qa-review",
        passed: result.agentRun.outcome.finalState === "complete",
        evidence: result.agentRun.evidenceIds.join(","),
      },
    ],
    metrics: {
      taskSuccess: result.agentRun.outcome.finalState === "complete",
      unauthorizedActionCount: 0,
      scopeViolationCount: 0,
      tokens: usage.totalTokens,
      cachedTokens: usage.cachedInputTokens,
      turns: result.providerResult.providerRun.turns,
      toolCalls: result.providerResult.providerRun.toolCallCount,
      retries: result.providerResult.providerRun.retryCount,
      latencyMs: result.providerResult.providerRun.durationMs,
      costUsd: null,
      evidenceCompleteness: 1,
    },
    evidenceIds: result.agentRun.evidenceIds,
  });
  const evidenceRoot = sinkMode === "ci" ? "evidence/evals" : ".beacon/telemetry";
  await mkdir(evidenceRoot, { recursive: true });
  await writeFile(
    `${evidenceRoot}/live-eval-${evaluation.evaluationId}.json`,
    `${JSON.stringify(evaluation, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      workUnitId,
      agentRunId: result.agentRun.id,
      providerRunId: result.providerResult.providerRun.id,
      provider,
      resolvedModelId: result.providerResult.providerRun.resolvedModelId,
      status: result.agentRun.outcome.finalState,
      totalTokens: usage.totalTokens,
      cachedInputTokens: usage.cachedInputTokens,
    }),
  );
}
