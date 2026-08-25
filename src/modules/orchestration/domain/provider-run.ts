import { z } from "astro/zod";

export const ProviderIdSchema = z.enum(["claude", "codex"]);
export const RunStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "blocked",
  "cancelled",
  "simulated",
]);
export const StopReasonSchema = z.enum([
  "completed",
  "max-turns",
  "model-call-budget-exhausted",
  "output-token-budget-exhausted",
  "tool-denied",
  "budget-exceeded",
  "provider-error",
  "capacity",
  "user-cancelled",
  "blocked",
  "unknown",
]);

const NullableTokenCountSchema = z.number().int().nonnegative().nullable();
const TimestampSchema = z.iso.datetime({ offset: true });

export const NormalizedTokenUsageSchema = z
  .object({
    totalInputTokens: NullableTokenCountSchema,
    cachedInputTokens: NullableTokenCountSchema,
    cacheWriteTokens: NullableTokenCountSchema,
    uncachedInputTokens: NullableTokenCountSchema,
    outputTokens: NullableTokenCountSchema,
    reasoningTokens: NullableTokenCountSchema,
    totalTokens: NullableTokenCountSchema,
  })
  .strict()
  .superRefine((usage, context) => {
    const expectedInputTokens =
      usage.totalInputTokens !== null &&
      usage.cachedInputTokens !== null &&
      usage.uncachedInputTokens !== null
        ? usage.cachedInputTokens +
          usage.uncachedInputTokens +
          (usage.cacheWriteTokens === null ? 0 : usage.cacheWriteTokens)
        : null;
    if (expectedInputTokens !== null && expectedInputTokens !== usage.totalInputTokens) {
      context.addIssue({
        code: "custom",
        message: "normalized input token components must equal totalInputTokens",
        path: ["totalInputTokens"],
      });
    }
    if (
      usage.totalTokens !== null &&
      usage.totalInputTokens !== null &&
      usage.outputTokens !== null &&
      usage.totalTokens !== usage.totalInputTokens + usage.outputTokens
    ) {
      context.addIssue({
        code: "custom",
        message: "totalTokens must equal totalInputTokens plus outputTokens",
        path: ["totalTokens"],
      });
    }
    if (
      usage.reasoningTokens !== null &&
      usage.outputTokens !== null &&
      usage.reasoningTokens > usage.outputTokens
    ) {
      context.addIssue({
        code: "custom",
        message: "reasoningTokens cannot exceed outputTokens",
        path: ["reasoningTokens"],
      });
    }
    if (
      usage.totalInputTokens !== null &&
      usage.cachedInputTokens !== null &&
      usage.cachedInputTokens > usage.totalInputTokens
    ) {
      context.addIssue({
        code: "custom",
        message: "cachedInputTokens cannot exceed totalInputTokens",
        path: ["cachedInputTokens"],
      });
    }
    if (
      usage.totalInputTokens !== null &&
      usage.cacheWriteTokens !== null &&
      usage.cacheWriteTokens > usage.totalInputTokens
    ) {
      context.addIssue({
        code: "custom",
        message: "cacheWriteTokens cannot exceed totalInputTokens",
        path: ["cacheWriteTokens"],
      });
    }
    if (
      usage.totalInputTokens !== null &&
      usage.uncachedInputTokens !== null &&
      usage.uncachedInputTokens > usage.totalInputTokens
    ) {
      context.addIssue({
        code: "custom",
        message: "uncachedInputTokens cannot exceed totalInputTokens",
        path: ["uncachedInputTokens"],
      });
    }
  });

export const ProviderRunSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1).max(160),
    agentRunId: z.string().min(1).max(160),
    workUnitId: z.string().min(1).max(160),
    taskFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    provider: ProviderIdSchema,
    resolvedModelId: z.string().min(1).max(160),
    requestedEffort: z.string().min(1).max(64).nullable(),
    startedAt: TimestampSchema,
    completedAt: TimestampSchema.nullable(),
    durationMs: z.number().int().nonnegative().nullable(),
    status: RunStatusSchema,
    stopReason: StopReasonSchema.nullable(),
    usage: NormalizedTokenUsageSchema,
    turns: z.number().int().nonnegative(),
    toolCallCount: z.number().int().nonnegative(),
    retryCount: z.number().int().nonnegative(),
    fallbackUsed: z.boolean(),
    handoffUsed: z.boolean(),
    providerMetadata: z.record(z.string(), z.unknown()),
  })
  .strict()
  .superRefine((run, context) => {
    const isOpen = run.status === "queued" || run.status === "running";
    if (isOpen && (run.completedAt !== null || run.durationMs !== null)) {
      context.addIssue({
        code: "custom",
        message: "open runs cannot have completion timestamps or durations",
        path: ["completedAt"],
      });
    }
    if (isOpen && run.stopReason !== null) {
      context.addIssue({
        code: "custom",
        message: "open runs cannot have a stopReason",
        path: ["stopReason"],
      });
    }
    if (!isOpen && (run.completedAt === null || run.durationMs === null)) {
      context.addIssue({
        code: "custom",
        message: "closed runs require completedAt and durationMs",
        path: ["completedAt"],
      });
    }
    if (!isOpen && run.stopReason === null) {
      context.addIssue({
        code: "custom",
        message: "closed runs require a stopReason",
        path: ["stopReason"],
      });
    }
  });

export type NormalizedTokenUsage = z.infer<typeof NormalizedTokenUsageSchema>;
export type ProviderRun = z.infer<typeof ProviderRunSchema>;

export function validateProviderRun(input: unknown): ProviderRun {
  return ProviderRunSchema.parse(input);
}
