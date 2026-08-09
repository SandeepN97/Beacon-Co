import { z } from "astro/zod";
import { AgentRiskClassSchema, AgentRoleSchema } from "./agent-run.ts";
import { DataClassificationSchema } from "./work-request.ts";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const RepositoryPathSchema = z
  .string()
  .min(1)
  .max(512)
  .refine(
    (path) => !path.startsWith("/") && !path.split("/").includes("..") && !path.includes("\0"),
    "paths must be repository-relative and cannot traverse parents",
  );

export const ContextInventoryEntrySchema = z
  .object({
    path: RepositoryPathSchema,
    sha256: Sha256Schema,
    bytes: z.number().int().nonnegative(),
    classification: DataClassificationSchema,
    delivery: z.enum(["reference", "embedded"]),
    exactData: z.boolean(),
    content: z.string().nullable(),
  })
  .strict()
  .superRefine((entry, context) => {
    if (entry.delivery === "embedded" && entry.content === null) {
      context.addIssue({
        code: "custom",
        message: "embedded inventory entries require content",
        path: ["content"],
      });
    }
    if (entry.delivery === "reference" && entry.content !== null) {
      context.addIssue({
        code: "custom",
        message: "reference inventory entries cannot contain file content",
        path: ["content"],
      });
    }
  });

export const ContextPackageSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1).max(160),
    workUnitId: z.string().min(1).max(160),
    taskFingerprint: Sha256Schema,
    agentRole: AgentRoleSchema,
    riskClass: AgentRiskClassSchema,
    contractSha256: Sha256Schema,
    allowedPaths: z.array(RepositoryPathSchema).min(1).max(200),
    allowedTools: z.array(z.string().min(1).max(80)).max(50),
    acceptanceCriteria: z.array(z.string().min(1).max(2000)).min(1).max(100),
    searchTerms: z.array(z.string().min(1).max(200)).min(1).max(50),
    inventory: z.array(ContextInventoryEntrySchema).max(200),
    contextBytes: z.number().int().nonnegative(),
    estimatedInputTokens: z.number().int().nonnegative(),
    maxContextTokens: z.number().int().positive(),
    budgetStatus: z.enum(["within-budget", "over-budget"]),
    duplicatesRemoved: z.number().int().nonnegative(),
    stablePrefixHash: Sha256Schema,
    variableContextHash: Sha256Schema,
    tokenAuditor: z
      .object({
        required: z.boolean(),
        reasons: z.array(
          z.enum([
            "budget-breach",
            "significant-duplication",
            "routing-ambiguity",
            "unusual-context-growth",
            "capacity-or-fallback",
          ]),
        ),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    const expectedStatus =
      value.estimatedInputTokens > value.maxContextTokens ? "over-budget" : "within-budget";
    if (value.budgetStatus !== expectedStatus) {
      context.addIssue({
        code: "custom",
        message: "budgetStatus must match estimatedInputTokens and maxContextTokens",
        path: ["budgetStatus"],
      });
    }
    if (value.tokenAuditor.required !== value.tokenAuditor.reasons.length > 0) {
      context.addIssue({
        code: "custom",
        message: "tokenAuditor.required must match whether trigger reasons exist",
        path: ["tokenAuditor", "required"],
      });
    }
  });

export type ContextInventoryEntry = z.infer<typeof ContextInventoryEntrySchema>;
export type ContextPackage = z.infer<typeof ContextPackageSchema>;

export function validateContextPackage(input: unknown): ContextPackage {
  return ContextPackageSchema.parse(input);
}
