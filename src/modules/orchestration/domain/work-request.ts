import { z } from "astro/zod";

export const WorkflowTypeSchema = z.enum([
  "documentation",
  "planning",
  "architecture",
  "implementation",
  "review",
  "operations",
  "mixed",
]);

export const RiskSchema = z.enum(["low", "medium", "high", "critical"]);
export const DataClassificationSchema = z.enum([
  "public",
  "internal",
  "confidential",
  "restricted",
]);
export const ProviderPreferenceSchema = z.enum(["claude", "codex", "auto"]);
export const WorkRequestStatusSchema = z.enum([
  "draft",
  "ready-for-routing",
  "waiting-for-user",
  "waiting-for-approval",
]);

export const WorkRequestSchema = z.object({
  id: z.string().min(1),
  rawRequest: z.string().min(1),
  normalizedGoal: z.string().min(1),
  businessOutcome: z.string().min(1),
  workflowType: WorkflowTypeSchema,
  requestedDeliverables: z.array(z.string()),
  acceptanceCriteria: z.array(z.string()),
  constraints: z.array(z.string()),
  nonGoals: z.array(z.string()),
  assumptions: z.array(z.string()),
  openQuestions: z.array(z.string()),
  dependencies: z.array(z.string()),
  risk: RiskSchema,
  dataClassification: DataClassificationSchema,
  requiredApprovals: z.array(z.string()),
  relevantDocs: z.array(z.string()),
  relevantAdrs: z.array(z.string()),
  recommendedFirstRole: z.string().min(1),
  preferredProvider: ProviderPreferenceSchema,
  providerReason: z.string().min(1),
  documentationImpactExpected: z.boolean(),
  status: WorkRequestStatusSchema,
});

export type WorkflowType = z.infer<typeof WorkflowTypeSchema>;
export type Risk = z.infer<typeof RiskSchema>;
export type DataClassification = z.infer<typeof DataClassificationSchema>;
export type ProviderPreference = z.infer<typeof ProviderPreferenceSchema>;
export type WorkRequestStatus = z.infer<typeof WorkRequestStatusSchema>;
export type WorkRequest = z.infer<typeof WorkRequestSchema>;

export function validateWorkRequest(input: unknown): WorkRequest {
  return WorkRequestSchema.parse(input);
}
