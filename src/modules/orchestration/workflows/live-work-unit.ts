import { createHash } from "node:crypto";
import { validateAgentRun, type AgentRole, type AgentRun } from "../domain/agent-run.ts";
import type { ContextPackage } from "../domain/context-package.ts";
import type { EvidenceRecord } from "../domain/evidence.ts";
import type { ProviderId } from "../domain/provider.ts";
import type { ProviderAdapter, ProviderExecutionResult } from "../providers/provider-adapter.ts";
import type { AppendOnlyNdjsonTelemetrySink } from "../telemetry/sink.ts";

export interface ValidationOutcome {
  passed: boolean;
  evidenceId: string;
  summary: string;
}

export interface ReviewOutcome extends ValidationOutcome {
  provider: ProviderId | "deterministic-policy";
  sessionId: string;
  blockerCount: number;
  majorCount: number;
}

export interface LiveWorkUnitInput {
  agentRunId: string;
  providerRunId: string;
  workUnitId: string;
  agentRole: AgentRole;
  contractVersion: string;
  contractSha256: string;
  contextPackage: ContextPackage;
  prompt: string;
  compilationHash: string;
  resolvedModelId: string;
  requestedEffort: string | null;
  maxOutputTokens: number;
  maxTurns: number;
}

export interface LiveWorkUnitDependencies {
  adapter: ProviderAdapter;
  telemetrySink: AppendOnlyNdjsonTelemetrySink;
  validate: (result: ProviderExecutionResult) => Promise<ValidationOutcome>;
  review: (result: ProviderExecutionResult) => Promise<ReviewOutcome>;
  now?: () => Date;
}

export async function executeLiveWorkUnit(
  input: LiveWorkUnitInput,
  dependencies: LiveWorkUnitDependencies,
): Promise<{
  agentRun: AgentRun;
  providerResult: ProviderExecutionResult;
  evidence: EvidenceRecord[];
}> {
  const now = dependencies.now ?? (() => new Date());
  const startedAt = now();
  const providerResult = await dependencies.adapter.execute({
    providerRunId: input.providerRunId,
    agentRunId: input.agentRunId,
    workUnitId: input.workUnitId,
    taskFingerprint: input.contextPackage.taskFingerprint,
    prompt: input.prompt,
    compilationHash: input.compilationHash,
    resolvedModelId: input.resolvedModelId,
    requestedEffort: input.requestedEffort,
    maxOutputTokens: input.maxOutputTokens,
    maxTurns: input.maxTurns,
  });
  const qa = await dependencies.validate(providerResult);
  const review = await dependencies.review(providerResult);
  const completedAt = now();
  const evidence: EvidenceRecord[] = [
    {
      id: `provider:${providerResult.providerRun.id}`,
      workUnitId: input.workUnitId,
      kind: "command",
      summary: `Provider output sha256 ${createHash("sha256").update(providerResult.outputText).digest("hex")}`,
      source: providerResult.providerRun.provider,
      recordedAt: completedAt.toISOString(),
      passed: providerResult.providerRun.status === "succeeded",
    },
    {
      id: qa.evidenceId,
      workUnitId: input.workUnitId,
      kind: "test",
      summary: qa.summary,
      source: "qa-engineer",
      recordedAt: completedAt.toISOString(),
      passed: qa.passed,
    },
    {
      id: review.evidenceId,
      workUnitId: input.workUnitId,
      kind: "review",
      summary: review.summary,
      source: `${review.provider}:${review.sessionId}`,
      recordedAt: completedAt.toISOString(),
      passed: review.passed,
    },
  ];
  const passed =
    providerResult.providerRun.status === "succeeded" &&
    qa.passed &&
    review.passed &&
    review.blockerCount === 0;
  const agentRun = validateAgentRun({
    schemaVersion: 1,
    id: input.agentRunId,
    workUnitId: input.workUnitId,
    taskFingerprint: input.contextPackage.taskFingerprint,
    agentRole: input.agentRole,
    contractVersion: input.contractVersion,
    contractSha256: input.contractSha256,
    riskClass: input.contextPackage.riskClass,
    provider: providerResult.providerRun.provider,
    resolvedModelId: providerResult.providerRun.resolvedModelId,
    requestedEffort: input.requestedEffort,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
    status: passed ? "succeeded" : "blocked",
    stopReason: passed ? "completed" : "blocked",
    providerRunIds: [providerResult.providerRun.id],
    context: {
      contextBytes: input.contextPackage.contextBytes,
      estimatedInputTokens: input.contextPackage.estimatedInputTokens,
      usage: providerResult.providerRun.usage,
      referencedFiles: input.contextPackage.inventory.map((entry) => ({
        path: entry.path,
        sha256: entry.sha256,
        classification: entry.classification,
      })),
      readFileCount: input.contextPackage.inventory.length,
      changedFileCount: 0,
      compilationHash: input.compilationHash,
    },
    execution: {
      turns: providerResult.providerRun.turns,
      toolCallCount: providerResult.providerRun.toolCallCount,
      retryCount: providerResult.providerRun.retryCount,
      fallbackUsed: providerResult.providerRun.fallbackUsed,
      handoffUsed: providerResult.providerRun.handoffUsed,
      policyDecisions: { allow: providerResult.toolEvidence.length, ask: 0, deny: 0 },
    },
    outcome: {
      authorValidationPassed: null,
      qaPassed: qa.passed,
      reviewDisposition: review.passed
        ? "approved"
        : review.blockerCount > 0
          ? "blocked"
          : "changes-requested",
      blockingFindingCount: review.blockerCount,
      majorFindingCount: review.majorCount,
      finalState: passed ? "complete" : "blocked",
    },
    evidenceIds: evidence.map((record) => record.id),
  });
  await dependencies.telemetrySink.append("provider-run", providerResult.providerRun);
  await dependencies.telemetrySink.append("agent-run", agentRun);
  return { agentRun, providerResult, evidence };
}
