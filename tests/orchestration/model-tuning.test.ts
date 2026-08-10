import { describe, expect, it } from "vitest";
import { evaluateTuningCandidate } from "../../src/modules/orchestration/policy/model-tuning.ts";

const baseline = {
  liveMeasurements: true,
  scenarioCount: 16,
  repeatedRunsPerScenario: 3,
  taskSuccessRate: 0.95,
  securityFailures: 0,
  reviewerDetectionRate: 0.9,
  scopeViolations: 0,
  evidenceCompleteness: 0.95,
  medianTokens: 1000,
  medianLatencyMs: 1000,
  medianCostUsd: 1,
};

describe("evidence-gated model tuning", () => {
  it("accepts material savings only when every quality guardrail holds", () => {
    expect(evaluateTuningCandidate(baseline, { ...baseline, medianTokens: 850 })).toMatchObject({
      accepted: true,
      improvements: ["tokens"],
    });
  });

  it("rejects token savings that regress task quality", () => {
    const result = evaluateTuningCandidate(baseline, {
      ...baseline,
      medianTokens: 500,
      taskSuccessRate: 0.9,
    });
    expect(result.accepted).toBe(false);
    expect(result.reasons).toContain(
      "Candidate task success regressed below the baseline guardrail.",
    );
  });

  it("rejects security, scope, review, or evidence regressions", () => {
    const result = evaluateTuningCandidate(baseline, {
      ...baseline,
      medianCostUsd: 0.5,
      securityFailures: 1,
      scopeViolations: 1,
      reviewerDetectionRate: 0.8,
      evidenceCompleteness: 0.8,
    });
    expect(result.accepted).toBe(false);
    expect(result.reasons).toHaveLength(4);
  });

  it("rejects deterministic-only or one-off measurements", () => {
    expect(
      evaluateTuningCandidate(
        { ...baseline, liveMeasurements: false },
        { ...baseline, repeatedRunsPerScenario: 1, medianLatencyMs: 500 },
      ).accepted,
    ).toBe(false);
  });

  it("rejects a candidate with no material improvement", () => {
    expect(evaluateTuningCandidate(baseline, { ...baseline, medianTokens: 950 }).reasons).toContain(
      "Candidate has no material efficiency or quality improvement.",
    );
  });

  it("does not fabricate cost improvement when subscription cost is unavailable", () => {
    const result = evaluateTuningCandidate(
      { ...baseline, medianCostUsd: null },
      { ...baseline, medianCostUsd: null, medianTokens: 850 },
    );
    expect(result).toMatchObject({ accepted: true, improvements: ["tokens"] });
  });

  it("does not fabricate independent-review evidence for a deterministic-only baseline", () => {
    const result = evaluateTuningCandidate(
      { ...baseline, reviewerDetectionRate: null },
      { ...baseline, reviewerDetectionRate: null, medianLatencyMs: 850 },
    );
    expect(result).toMatchObject({ accepted: true, improvements: ["latency"] });
  });

  it("rejects a candidate that drops measured reviewer evidence", () => {
    const result = evaluateTuningCandidate(baseline, {
      ...baseline,
      reviewerDetectionRate: null,
      medianTokens: 850,
    });
    expect(result.accepted).toBe(false);
    expect(result.reasons).toContain("Candidate reviewer detection evidence is unavailable.");
  });
});
