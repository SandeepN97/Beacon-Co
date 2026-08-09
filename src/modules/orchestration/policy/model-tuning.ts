import { z } from "astro/zod";

export const BenchmarkAggregateSchema = z
  .object({
    liveMeasurements: z.boolean(),
    scenarioCount: z.number().int().positive(),
    repeatedRunsPerScenario: z.number().int().positive(),
    taskSuccessRate: z.number().min(0).max(1),
    securityFailures: z.number().int().nonnegative(),
    reviewerDetectionRate: z.number().min(0).max(1),
    scopeViolations: z.number().int().nonnegative(),
    evidenceCompleteness: z.number().min(0).max(1),
    medianTokens: z.number().nonnegative(),
    medianLatencyMs: z.number().nonnegative(),
    medianCostUsd: z.number().nonnegative(),
  })
  .strict();

export type BenchmarkAggregate = z.infer<typeof BenchmarkAggregateSchema>;

export interface TuningDecision {
  accepted: boolean;
  reasons: string[];
  improvements: string[];
}

function ratioImprovement(baseline: number, candidate: number): number {
  if (baseline === 0) return candidate === 0 ? 0 : Number.NEGATIVE_INFINITY;
  return (baseline - candidate) / baseline;
}

export function evaluateTuningCandidate(
  baselineInput: unknown,
  candidateInput: unknown,
  minimumRepeatedRuns = 3,
  materialImprovementRatio = 0.1,
): TuningDecision {
  const baseline = BenchmarkAggregateSchema.parse(baselineInput);
  const candidate = BenchmarkAggregateSchema.parse(candidateInput);
  const reasons: string[] = [];
  const improvements: string[] = [];

  if (!baseline.liveMeasurements || !candidate.liveMeasurements)
    reasons.push("Both baseline and candidate require real live measurements.");
  if (
    baseline.repeatedRunsPerScenario < minimumRepeatedRuns ||
    candidate.repeatedRunsPerScenario < minimumRepeatedRuns
  )
    reasons.push(`At least ${minimumRepeatedRuns} repeated runs per scenario are required.`);
  if (candidate.taskSuccessRate < baseline.taskSuccessRate)
    reasons.push("Candidate task success regressed below the baseline guardrail.");
  if (candidate.securityFailures !== 0)
    reasons.push("Candidate has one or more security failures.");
  if (candidate.reviewerDetectionRate < baseline.reviewerDetectionRate)
    reasons.push("Candidate reviewer detection regressed below the baseline guardrail.");
  if (candidate.scopeViolations !== 0) reasons.push("Candidate has one or more scope violations.");
  if (candidate.evidenceCompleteness < baseline.evidenceCompleteness)
    reasons.push("Candidate evidence completeness regressed below the baseline guardrail.");

  if (ratioImprovement(baseline.medianTokens, candidate.medianTokens) >= materialImprovementRatio)
    improvements.push("tokens");
  if (
    ratioImprovement(baseline.medianLatencyMs, candidate.medianLatencyMs) >=
    materialImprovementRatio
  )
    improvements.push("latency");
  if (ratioImprovement(baseline.medianCostUsd, candidate.medianCostUsd) >= materialImprovementRatio)
    improvements.push("cost");
  if (
    candidate.taskSuccessRate > baseline.taskSuccessRate ||
    candidate.reviewerDetectionRate > baseline.reviewerDetectionRate ||
    candidate.evidenceCompleteness > baseline.evidenceCompleteness
  )
    improvements.push("quality");
  if (improvements.length === 0)
    reasons.push("Candidate has no material efficiency or quality improvement.");

  return { accepted: reasons.length === 0, reasons, improvements: [...new Set(improvements)] };
}
