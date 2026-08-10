import { z } from "astro/zod";
import { BenchmarkAggregateSchema } from "../policy/model-tuning.ts";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const CorrelationIdSchema = z.string().min(1).max(160);

export const LiveBaselineScenarioCatalogSchema = z
  .object({
    schemaVersion: z.literal(1),
    scenarios: z
      .array(
        z
          .object({
            id: z.string().min(1).max(160),
            agentRole: z.string().min(1).max(160),
            riskClass: z.enum(["risk-0", "risk-1", "risk-2", "risk-3"]),
            objective: z.string().min(1).max(2000),
            expectedOutput: z.string().min(1).max(200),
            acceptanceCriteria: z.array(z.string().min(1).max(500)).min(1).max(20),
            searchTerms: z.array(z.string().min(1).max(200)).max(20),
          })
          .strict(),
      )
      .min(2),
  })
  .strict();

export const LiveBaselineRunEvidenceSchema = z
  .object({
    schemaVersion: z.literal(1),
    scenarioId: z.string().min(1).max(160),
    repetition: z.number().int().positive(),
    agentRole: z.string().min(1).max(160),
    riskClass: z.enum(["risk-0", "risk-1", "risk-2", "risk-3"]),
    provider: z.literal("codex"),
    authenticationPath: z.literal("subscription-cli"),
    resolvedModelId: z.string().min(1).max(160),
    workUnitId: CorrelationIdSchema,
    agentRunId: CorrelationIdSchema,
    providerRunId: CorrelationIdSchema,
    evaluationId: CorrelationIdSchema,
    taskFingerprint: Sha256Schema,
    contextCompilationHash: Sha256Schema,
    outputSha256: Sha256Schema,
    status: z.enum(["succeeded", "failed", "blocked"]),
    durationMs: z.number().int().nonnegative(),
    contextBytes: z.number().int().nonnegative(),
    estimatedContextTokens: z.number().int().nonnegative(),
    usage: z
      .object({
        totalInputTokens: z.number().int().nonnegative(),
        cachedInputTokens: z.number().int().nonnegative(),
        uncachedInputTokens: z.number().int().nonnegative(),
        outputTokens: z.number().int().nonnegative(),
        totalTokens: z.number().int().nonnegative(),
      })
      .strict(),
    turns: z.number().int().nonnegative(),
    toolCallCount: z.number().int().nonnegative(),
    retryCount: z.number().int().nonnegative(),
    fallbackUsed: z.boolean(),
    handoffUsed: z.boolean(),
    qaDisposition: z.enum(["passed", "failed"]),
    reviewDisposition: z.enum(["approved", "changes-requested", "blocked"]),
    reviewMethod: z.literal("deterministic-policy"),
    securityFailures: z.number().int().nonnegative(),
    scopeViolations: z.number().int().nonnegative(),
    evidenceCompleteness: z.number().min(0).max(1),
  })
  .strict()
  .superRefine((run, context) => {
    if (
      run.usage.cachedInputTokens + run.usage.uncachedInputTokens !==
      run.usage.totalInputTokens
    ) {
      context.addIssue({
        code: "custom",
        message: "cached and uncached input tokens must equal total input tokens",
        path: ["usage", "totalInputTokens"],
      });
    }
    if (run.usage.totalInputTokens + run.usage.outputTokens !== run.usage.totalTokens) {
      context.addIssue({
        code: "custom",
        message: "input and output tokens must equal total tokens",
        path: ["usage", "totalTokens"],
      });
    }
  });

export const LiveBaselineAggregateSchema = z
  .object({
    schemaVersion: z.literal(1),
    evidenceType: z.literal("bounded-redacted-repeated-live-baseline"),
    generatedAt: z.iso.datetime({ offset: true }),
    candidateSha: Sha256Schema,
    provider: z.literal("codex"),
    authenticationPath: z.literal("subscription-cli"),
    scenarioIds: z.array(z.string().min(1).max(160)).min(1),
    totalRuns: z.number().int().positive(),
    benchmarkAggregate: BenchmarkAggregateSchema,
    runs: z.array(LiveBaselineRunEvidenceSchema).min(1),
    accepted: z.boolean(),
    acceptanceReasons: z.array(z.string().min(1).max(500)),
    tuningApplied: z.literal(false),
    redaction: z
      .object({
        promptsStored: z.literal(false),
        responsesStored: z.literal(false),
        credentialsStored: z.literal(false),
        providerMetadataStored: z.literal(false),
        outputHashesStored: z.literal(true),
      })
      .strict(),
  })
  .strict();

export type LiveBaselineRunEvidence = z.infer<typeof LiveBaselineRunEvidenceSchema>;
export type LiveBaselineAggregate = z.infer<typeof LiveBaselineAggregateSchema>;

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function uniqueCorrelations(runs: LiveBaselineRunEvidence[], key: keyof LiveBaselineRunEvidence) {
  return new Set(runs.map((run) => String(run[key]))).size === runs.length;
}

export function compileLiveBaselineAggregate(input: {
  runs: unknown[];
  candidateSha: string;
  generatedAt: string;
  minimumScenarios: number;
  minimumRepeatedRuns: number;
}): LiveBaselineAggregate {
  const runs = input.runs.map((run) => LiveBaselineRunEvidenceSchema.parse(run));
  if (runs.length === 0) throw new Error("A live baseline requires at least one observed run.");
  const reasons: string[] = [];
  const byScenario = new Map<string, LiveBaselineRunEvidence[]>();
  for (const run of runs) {
    const group = byScenario.get(run.scenarioId) ?? [];
    group.push(run);
    byScenario.set(run.scenarioId, group);
  }
  const scenarioIds = [...byScenario.keys()].sort();
  if (scenarioIds.length < input.minimumScenarios) {
    reasons.push(`At least ${input.minimumScenarios} distinct live scenarios are required.`);
  }
  for (const [scenarioId, group] of byScenario) {
    if (group.length < input.minimumRepeatedRuns) {
      reasons.push(
        `${scenarioId} requires at least ${input.minimumRepeatedRuns} real repetitions.`,
      );
    }
    if (new Set(group.map((run) => run.repetition)).size !== group.length) {
      reasons.push(`${scenarioId} has duplicate repetition identifiers.`);
    }
    if (new Set(group.map((run) => run.taskFingerprint)).size !== 1) {
      reasons.push(`${scenarioId} repetitions do not share one deterministic task fingerprint.`);
    }
    if (new Set(group.map((run) => run.contextCompilationHash)).size !== 1) {
      reasons.push(`${scenarioId} repetitions do not share one deterministic context hash.`);
    }
  }
  if (new Set(runs.map((run) => run.taskFingerprint)).size !== scenarioIds.length) {
    reasons.push("Each live scenario must have a distinct task fingerprint.");
  }
  if (new Set(runs.map((run) => run.contextCompilationHash)).size !== scenarioIds.length) {
    reasons.push("Each live scenario must have a distinct context compilation hash.");
  }
  if (new Set(runs.map((run) => run.resolvedModelId)).size !== 1) {
    reasons.push("A baseline must measure one resolved model configuration.");
  }
  for (const key of ["workUnitId", "agentRunId", "providerRunId", "evaluationId"] as const) {
    if (!uniqueCorrelations(runs, key)) reasons.push(`${key} values must be unique per run.`);
  }
  const successful = runs.filter(
    (run) =>
      run.status === "succeeded" &&
      run.qaDisposition === "passed" &&
      run.reviewDisposition === "approved",
  ).length;
  const securityFailures = runs.reduce((total, run) => total + run.securityFailures, 0);
  const scopeViolations = runs.reduce((total, run) => total + run.scopeViolations, 0);
  const evidenceCompleteness =
    runs.reduce((total, run) => total + run.evidenceCompleteness, 0) / runs.length;
  const taskSuccessRate = successful / runs.length;
  if (taskSuccessRate !== 1)
    reasons.push("Every repeated live run must pass provider, QA, and review gates.");
  if (securityFailures !== 0) reasons.push("The live baseline contains security failures.");
  if (scopeViolations !== 0) reasons.push("The live baseline contains scope violations.");
  if (evidenceCompleteness !== 1)
    reasons.push("Every live run requires complete bounded evidence.");
  const repeatedRunsPerScenario = Math.min(
    ...[...byScenario.values()].map((group) => group.length),
  );
  const benchmarkAggregate = BenchmarkAggregateSchema.parse({
    liveMeasurements: true,
    scenarioCount: scenarioIds.length,
    repeatedRunsPerScenario,
    taskSuccessRate,
    securityFailures,
    reviewerDetectionRate: null,
    scopeViolations,
    evidenceCompleteness,
    medianTokens: median(runs.map((run) => run.usage.totalTokens)),
    medianLatencyMs: median(runs.map((run) => run.durationMs)),
    medianCostUsd: null,
  });
  return LiveBaselineAggregateSchema.parse({
    schemaVersion: 1,
    evidenceType: "bounded-redacted-repeated-live-baseline",
    generatedAt: input.generatedAt,
    candidateSha: input.candidateSha,
    provider: "codex",
    authenticationPath: "subscription-cli",
    scenarioIds,
    totalRuns: runs.length,
    benchmarkAggregate,
    runs: [...runs].sort(
      (left, right) =>
        left.scenarioId.localeCompare(right.scenarioId) || left.repetition - right.repetition,
    ),
    accepted: reasons.length === 0,
    acceptanceReasons: reasons,
    tuningApplied: false,
    redaction: {
      promptsStored: false,
      responsesStored: false,
      credentialsStored: false,
      providerMetadataStored: false,
      outputHashesStored: true,
    },
  });
}
