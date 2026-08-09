import { z } from "astro/zod";
import { AgentRiskClassSchema } from "./agent-run.ts";
import { ProviderIdSchema } from "./provider-run.ts";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const ReviewFindingSchema = z
  .object({
    id: z.string().min(1).max(160),
    severity: z.enum(["blocker", "major", "minor"]),
    rootCause: z.string().min(1).max(500),
    evidence: z.array(z.string().min(1).max(1000)).max(20),
    reproduced: z.boolean(),
  })
  .strict();

export const ReviewLaneEvidenceSchema = z
  .object({
    authorRunId: z.string().min(1).max(160),
    reviewRunId: z.string().min(1).max(160),
    provider: ProviderIdSchema,
    sessionId: z.string().min(1).max(160),
    lens: z.enum(["correctness-architecture", "adversarial-security", "operational-release"]),
    diffHash: Sha256Schema,
    completedWithoutPeerOutputs: z.boolean(),
    findings: z.array(ReviewFindingSchema).max(100),
  })
  .strict();

export const CouncilEvidenceSchema = z
  .object({
    schemaVersion: z.literal(1),
    workUnitId: z.string().min(1).max(160),
    authorRunId: z.string().min(1).max(160),
    authorProvider: ProviderIdSchema,
    riskClass: AgentRiskClassSchema,
    diffHash: Sha256Schema,
    deterministicChecksPassed: z.boolean(),
    productionRelease: z.boolean(),
    reviews: z.array(ReviewLaneEvidenceSchema).max(3),
    humanDecision: z.enum(["approved", "rejected"]).nullable(),
  })
  .strict();

export type ReviewFinding = z.infer<typeof ReviewFindingSchema>;
export type ReviewLaneEvidence = z.infer<typeof ReviewLaneEvidenceSchema>;
export type CouncilEvidence = z.infer<typeof CouncilEvidenceSchema>;
