import { z } from "astro/zod";
import { DataClassificationSchema } from "./work-request.ts";
import {
  NormalizedTokenUsageSchema,
  ProviderIdSchema,
  RunStatusSchema,
  StopReasonSchema,
} from "./provider-run.ts";

export const AgentRoleSchema = z.enum([
  "chief-of-staff",
  "market-researcher",
  "codebase-researcher",
  "code-writer",
  "qa-engineer",
  "pr-reviewer",
  "release-manager",
  "token-auditor",
]);
export const AgentRiskClassSchema = z.enum(["risk-0", "risk-1", "risk-2", "risk-3"]);

const TimestampSchema = z.iso.datetime({ offset: true });
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const RepositoryPathSchema = z
  .string()
  .min(1)
  .max(512)
  .refine(
    (path) => !path.startsWith("/") && !path.split("/").includes("..") && !path.includes("\0"),
    "referenced paths must be repository-relative and cannot traverse parents",
  );

export const ReferencedFileSchema = z
  .object({
    path: RepositoryPathSchema,
    sha256: Sha256Schema,
    classification: DataClassificationSchema,
  })
  .strict();

export const AgentRunSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1).max(160),
    workUnitId: z.string().min(1).max(160),
    taskFingerprint: Sha256Schema,
    agentRole: AgentRoleSchema,
    contractVersion: z.string().min(1).max(64),
    contractSha256: Sha256Schema,
    riskClass: AgentRiskClassSchema,
    provider: ProviderIdSchema.nullable(),
    resolvedModelId: z.string().min(1).max(160).nullable(),
    requestedEffort: z.string().min(1).max(64).nullable(),
    startedAt: TimestampSchema,
    completedAt: TimestampSchema.nullable(),
    durationMs: z.number().int().nonnegative().nullable(),
    status: RunStatusSchema,
    stopReason: StopReasonSchema.nullable(),
    providerRunIds: z.array(z.string().min(1).max(160)),
    context: z
      .object({
        contextBytes: z.number().int().nonnegative(),
        estimatedInputTokens: z.number().int().nonnegative().nullable(),
        usage: NormalizedTokenUsageSchema,
        referencedFiles: z.array(ReferencedFileSchema).max(500),
        readFileCount: z.number().int().nonnegative(),
        changedFileCount: z.number().int().nonnegative(),
        compilationHash: Sha256Schema.nullable(),
      })
      .strict(),
    execution: z
      .object({
        turns: z.number().int().nonnegative(),
        toolCallCount: z.number().int().nonnegative(),
        retryCount: z.number().int().nonnegative(),
        fallbackUsed: z.boolean(),
        handoffUsed: z.boolean(),
        policyDecisions: z
          .object({
            allow: z.number().int().nonnegative(),
            ask: z.number().int().nonnegative(),
            deny: z.number().int().nonnegative(),
          })
          .strict(),
      })
      .strict(),
    outcome: z
      .object({
        authorValidationPassed: z.boolean().nullable(),
        qaPassed: z.boolean().nullable(),
        reviewDisposition: z.enum([
          "not-reviewed",
          "approved",
          "approved-with-follow-up",
          "changes-requested",
          "blocked",
        ]),
        blockingFindingCount: z.number().int().nonnegative(),
        majorFindingCount: z.number().int().nonnegative(),
        finalState: z.enum(["in-progress", "review", "complete", "failed", "blocked", "cancelled"]),
      })
      .strict(),
    evidenceIds: z.array(z.string().min(1).max(160)).max(500),
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
    if (run.provider === null && (run.resolvedModelId !== null || run.providerRunIds.length > 0)) {
      context.addIssue({
        code: "custom",
        message: "provider-less runs cannot identify a model or provider runs",
        path: ["provider"],
      });
    }
    if (run.provider !== null && run.resolvedModelId === null) {
      context.addIssue({
        code: "custom",
        message: "provider runs require a resolvedModelId",
        path: ["resolvedModelId"],
      });
    }
  });

export type AgentRole = z.infer<typeof AgentRoleSchema>;
export type AgentRiskClass = z.infer<typeof AgentRiskClassSchema>;
export type ReferencedFile = z.infer<typeof ReferencedFileSchema>;
export type AgentRun = z.infer<typeof AgentRunSchema>;

export function validateAgentRun(input: unknown): AgentRun {
  return AgentRunSchema.parse(input);
}
