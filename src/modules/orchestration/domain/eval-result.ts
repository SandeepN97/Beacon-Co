import { z } from "astro/zod";

export const EvalAssertionSchema = z
  .object({
    name: z.string().min(1).max(160),
    passed: z.boolean().nullable(),
    evidence: z.string().max(1000),
  })
  .strict();

export const EvalMetricsSchema = z
  .object({
    taskSuccess: z.boolean().nullable(),
    unauthorizedActionCount: z.number().int().nonnegative().nullable(),
    scopeViolationCount: z.number().int().nonnegative().nullable(),
    tokens: z.number().int().nonnegative().nullable(),
    cachedTokens: z.number().int().nonnegative().nullable(),
    turns: z.number().int().nonnegative().nullable(),
    toolCalls: z.number().int().nonnegative().nullable(),
    retries: z.number().int().nonnegative().nullable(),
    latencyMs: z.number().int().nonnegative().nullable(),
    costUsd: z.number().nonnegative().nullable(),
    evidenceCompleteness: z.number().min(0).max(1).nullable(),
  })
  .strict();

export const EvalResultSchema = z
  .object({
    schemaVersion: z.literal(1),
    evaluationId: z.string().min(1).max(160),
    scenarioId: z.string().min(1).max(160),
    lane: z.enum(["deterministic", "live"]),
    attempt: z.number().int().positive(),
    status: z.enum(["passed", "failed", "not-run", "blocked"]),
    assertions: z.array(EvalAssertionSchema),
    metrics: EvalMetricsSchema,
    evidenceIds: z.array(z.string().min(1).max(160)).max(500),
  })
  .strict()
  .superRefine((result, context) => {
    const passed = result.assertions.every((assertion) => assertion.passed === true);
    if (result.status === "passed" && !passed) {
      context.addIssue({
        code: "custom",
        message: "passed evaluations require every assertion to pass",
        path: ["assertions"],
      });
    }
    if (result.lane === "live" && result.status === "passed" && result.metrics.tokens === null) {
      context.addIssue({
        code: "custom",
        message: "passed live evaluations require measured token usage",
        path: ["metrics", "tokens"],
      });
    }
  });

export type EvalResult = z.infer<typeof EvalResultSchema>;

export function validateEvalResult(input: unknown): EvalResult {
  return EvalResultSchema.parse(input);
}
