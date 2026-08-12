import { z } from "astro/zod";
import {
  DecisionCandidateIdSchema,
  DecisionPackageIdSchema,
  ResearchThreadIdSchema,
  UnderstandingVersionIdSchema,
} from "./ids.ts";

/** Section 18's DecisionReadiness struct. */
export const DecisionReadinessSchema = z
  .object({
    problemDefined: z.boolean(),
    currentStateVerified: z.boolean(),
    primaryEvidencePresent: z.boolean(),
    credibleAlternativesCompared: z.boolean(),
    contradictionsHandled: z.boolean(),
    securityConsidered: z.boolean(),
    costComplexityConsidered: z.boolean(),
    architectureImpactKnown: z.boolean(),
    experimentDispositionKnown: z.boolean(),
    revisitConditionsDefined: z.boolean(),
    readyForAdr: z.boolean(),
  })
  .strict()
  .superRefine((readiness, ctx) => {
    const { readyForAdr, ...dimensions } = readiness;
    if (readyForAdr && !Object.values(dimensions).every(Boolean)) {
      ctx.addIssue({
        code: "custom",
        message: "readyForAdr cannot be true unless every other readiness dimension is true too",
        path: ["readyForAdr"],
      });
    }
  });
export type DecisionReadiness = z.infer<typeof DecisionReadinessSchema>;

/** Section 18's three dispositions. */
export const DecisionDispositionSchema = z.enum(["accept", "continue-research", "reject"]);
export type DecisionDisposition = z.infer<typeof DecisionDispositionSchema>;

/**
 * A Decision Candidate. Per Section 18's own "Accept" row -- "Create DecisionAccepted
 * and begin ADR request; still not executable until ADR accepted" -- disposition
 * "accept" is a request to begin ADR authoring, never authorization by itself. See
 * authority.ts for the enforced boundary.
 */
export const DecisionCandidateSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: DecisionCandidateIdSchema,
    threadId: ResearchThreadIdSchema,
    understandingVersionRef: UnderstandingVersionIdSchema,
    readiness: DecisionReadinessSchema,
    disposition: DecisionDispositionSchema.nullable(),
    rejectionReason: z.string().min(1).max(2000).nullable(),
    reconsiderationTriggers: z.array(z.string().min(1).max(1000)).max(50),
  })
  .strict()
  .superRefine((candidate, ctx) => {
    if (candidate.disposition === "accept" && !candidate.readiness.readyForAdr) {
      ctx.addIssue({
        code: "custom",
        message:
          'a Decision Candidate cannot be disposed "accept" unless readiness.readyForAdr is true',
        path: ["disposition"],
      });
    }
    if (candidate.disposition === "reject" && candidate.rejectionReason === null) {
      ctx.addIssue({
        code: "custom",
        message: 'disposition "reject" requires a rejectionReason',
        path: ["rejectionReason"],
      });
    }
  });
export type DecisionCandidate = z.infer<typeof DecisionCandidateSchema>;

/**
 * A reference to a real, persisted ADR under src/content/docs/decisions/. This is the
 * only object in this domain carrying a `status` that can read `"accepted"`, and per
 * Section 19's authority invariant it is the only thing `assertExecutionAuthorized`
 * (./authority.ts) will accept -- never a DecisionCandidate, however it is disposed.
 */
export const AdrRefSchema = z
  .object({
    schemaVersion: z.literal(1),
    adrId: z
      .string()
      .regex(
        /^\d{4}-[a-z0-9-]+$/,
        "must match the decisions/ ADR slug convention, e.g. 0019-begin-phase-1-6...",
      ),
    status: z.enum(["requested", "accepted", "superseded"]),
    decisionCandidateRef: DecisionCandidateIdSchema,
  })
  .strict();
export type AdrRef = z.infer<typeof AdrRefSchema>;

/** Section 20's compact DecisionPackage: what crosses into frozen Phase 1.5 execution. */
export const DecisionPackageSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: DecisionPackageIdSchema,
    adrId: z.string().regex(/^\d{4}-[a-z0-9-]+$/),
    objective: z.string().min(1).max(2000),
    acceptanceCriteria: z.array(z.string().min(1).max(1000)).min(1).max(50),
    invariants: z.array(z.string().min(1).max(1000)).max(50),
    constraints: z.array(z.string().min(1).max(1000)).max(50),
    securityRequirements: z.array(z.string().min(1).max(1000)).max(50),
    risk: z.enum(["low", "medium", "high", "critical"]),
    architectureRefs: z.array(z.string().min(1).max(500)).max(50),
    documentationRefs: z.array(z.string().min(1).max(500)).max(50),
    evidenceRefs: z.array(z.string().min(1).max(500)).max(200),
    unresolvedRisks: z.array(z.string().min(1).max(1000)).max(50),
    revisitConditions: z.array(z.string().min(1).max(1000)).max(50),
  })
  .strict();
export type DecisionPackage = z.infer<typeof DecisionPackageSchema>;

export function validateDecisionReadiness(input: unknown): DecisionReadiness {
  return DecisionReadinessSchema.parse(input);
}

export function validateDecisionCandidate(input: unknown): DecisionCandidate {
  return DecisionCandidateSchema.parse(input);
}

export function validateAdrRef(input: unknown): AdrRef {
  return AdrRefSchema.parse(input);
}

export function validateDecisionPackage(input: unknown): DecisionPackage {
  return DecisionPackageSchema.parse(input);
}
