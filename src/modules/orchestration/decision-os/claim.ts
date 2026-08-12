import { z } from "astro/zod";
import { ClaimIdSchema, EvidenceIdSchema } from "./ids.ts";

/** Section 10's six claim statuses. */
export const ClaimStatusSchema = z.enum([
  "supported",
  "supported-with-limits",
  "contested",
  "unresolved",
  "superseded",
  "rejected",
]);
export type ClaimStatus = z.infer<typeof ClaimStatusSchema>;

/**
 * Appendix A's Claim contract, with Section 10.1's anti-confirmation rule enforced
 * structurally rather than left as a review-only guideline:
 * - the same evidence record cannot both support and contradict a claim;
 * - a claim marked "contested" must actually carry contradicting evidence, so
 *   "contested" cannot be asserted without the evidence Section 10.1 requires
 *   ("actively search for credible contradictory evidence... preserve supporting and
 *   contradicting evidence together").
 */
export const ClaimSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: ClaimIdSchema,
    normalizedClaim: z.string().min(1).max(2000),
    status: ClaimStatusSchema,
    supportingEvidenceRefs: z.array(EvidenceIdSchema).max(200),
    contradictingEvidenceRefs: z.array(EvidenceIdSchema).max(200),
    boundaryConditions: z.array(z.string().min(1).max(1000)).max(50),
    confidenceBasis: z.string().min(1).max(1000).nullable(),
    applicabilityToBeacon: z.string().min(1).max(2000).nullable(),
    supersedesClaimRef: ClaimIdSchema.nullable(),
    revalidationTriggers: z.array(z.string().min(1).max(500)).max(50),
    relatedConceptRefs: z.array(z.string().min(1).max(300)).max(100),
  })
  .strict()
  .superRefine((claim, ctx) => {
    const overlap = claim.supportingEvidenceRefs.filter((id) =>
      claim.contradictingEvidenceRefs.includes(id),
    );
    if (overlap.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: "the same evidence cannot both support and contradict one claim",
        path: ["contradictingEvidenceRefs"],
      });
    }
    if (claim.status === "contested" && claim.contradictingEvidenceRefs.length === 0) {
      ctx.addIssue({
        code: "custom",
        message:
          'status "contested" requires at least one contradicting evidence reference (Section 10.1 anti-confirmation rule)',
        path: ["contradictingEvidenceRefs"],
      });
    }
  });
export type Claim = z.infer<typeof ClaimSchema>;

export function validateClaim(input: unknown): Claim {
  return ClaimSchema.parse(input);
}
