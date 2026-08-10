import { describe, expect, it } from "vitest";
import { compileLiveBaselineAggregate } from "../../src/modules/orchestration/evals/live-baseline.ts";

function run(scenarioId: string, repetition: number) {
  const scenarioIndex = scenarioId === "scenario-a" ? "a" : "b";
  return {
    schemaVersion: 1 as const,
    scenarioId,
    repetition,
    agentRole: "codebase-researcher",
    riskClass: "risk-0" as const,
    provider: "codex" as const,
    authenticationPath: "subscription-cli" as const,
    resolvedModelId: "gpt-approved",
    workUnitId: `work-${scenarioId}-${repetition}`,
    agentRunId: `agent-${scenarioId}-${repetition}`,
    providerRunId: `provider-${scenarioId}-${repetition}`,
    evaluationId: `eval-${scenarioId}-${repetition}`,
    taskFingerprint: scenarioIndex.repeat(64),
    contextCompilationHash: (scenarioIndex === "a" ? "c" : "d").repeat(64),
    outputSha256: "e".repeat(64),
    status: "succeeded" as const,
    durationMs: 100 + repetition,
    contextBytes: 400,
    estimatedContextTokens: 100,
    usage: {
      totalInputTokens: 100,
      cachedInputTokens: 40,
      uncachedInputTokens: 60,
      outputTokens: 5,
      totalTokens: 105,
    },
    turns: 1,
    toolCallCount: 0,
    retryCount: 0,
    fallbackUsed: false,
    handoffUsed: false,
    qaDisposition: "passed" as const,
    reviewDisposition: "approved" as const,
    reviewMethod: "deterministic-policy" as const,
    securityFailures: 0,
    scopeViolations: 0,
    evidenceCompleteness: 1,
  };
}

const acceptedRuns = [1, 2, 3].flatMap((repetition) => [
  run("scenario-a", repetition),
  run("scenario-b", repetition),
]);

function compile(runs: unknown[]) {
  return compileLiveBaselineAggregate({
    runs,
    candidateSha: "f".repeat(64),
    generatedAt: "2026-08-09T20:00:00-04:00",
    minimumScenarios: 2,
    minimumRepeatedRuns: 3,
  });
}

describe("repeated live baseline acceptance", () => {
  it("requires observed live runs", () => {
    expect(() => compile([])).toThrow("A live baseline requires at least one observed run.");
  });

  it("accepts two distinct scenarios with three complete real repetitions each", () => {
    const result = compile(acceptedRuns);
    expect(result.accepted).toBe(true);
    expect(result.benchmarkAggregate).toMatchObject({
      liveMeasurements: true,
      scenarioCount: 2,
      repeatedRunsPerScenario: 3,
      reviewerDetectionRate: null,
      medianCostUsd: null,
    });
  });

  it("rejects repeated copies of one smoke fingerprint", () => {
    const result = compile([1, 2, 3].map((repetition) => run("scenario-a", repetition)));
    expect(result.accepted).toBe(false);
    expect(result.acceptanceReasons).toContain("At least 2 distinct live scenarios are required.");
  });

  it("rejects missing repetitions or incomplete quality evidence", () => {
    const incomplete = acceptedRuns
      .slice(0, 4)
      .map((entry, index) =>
        index === 0 ? { ...entry, qaDisposition: "failed" as const } : entry,
      );
    const result = compile(incomplete);
    expect(result.accepted).toBe(false);
    expect(result.acceptanceReasons).toContain(
      "Every repeated live run must pass provider, QA, and review gates.",
    );
  });
});
