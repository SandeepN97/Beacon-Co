import { z } from "astro/zod";
import { DataClassificationSchema } from "../../orchestration/domain/work-request.ts";
import { ClaimIdSchema, EvidenceIdSchema, SourceIdSchema } from "./ids.ts";
import { FreshnessClassSchema } from "./visibility.ts";

const TimestampSchema = z.iso.datetime({ offset: true });
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

/** Section 8's evidence-acquisition source hierarchy, in priority order. */
export const SourceTypeSchema = z.enum([
  "beacon-implementation",
  "primary-technical",
  "peer-reviewed",
  "systematic-review",
  "open-source",
  "community",
]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const SourceSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: SourceIdSchema,
    canonicalUri: z.string().min(1).max(2000),
    sourceType: SourceTypeSchema,
    title: z.string().min(1).max(500),
    authorOrOrg: z.string().min(1).max(300).nullable(),
    publishedAt: TimestampSchema.nullable(),
    retrievedAt: TimestampSchema,
    versionOrCommit: z.string().min(1).max(160).nullable(),
    freshnessClass: FreshnessClassSchema,
    integrityHash: Sha256Schema.nullable(),
    licenseOrUsageNotes: z.string().max(1000).nullable(),
    /** Section 27: source excerpts are bounded and copyright-aware; sensitive or
     * customer-derived sources require explicit classification. */
    dataClassification: DataClassificationSchema,
  })
  .strict();
export type Source = z.infer<typeof SourceSchema>;

/** Section 8's Evidence struct, faithfully typed from the spec's own pseudocode block. */
export const EvidenceSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: EvidenceIdSchema,
    sourceRef: SourceIdSchema,
    retrievedAt: TimestampSchema,
    sourceType: SourceTypeSchema,
    claimRefs: z.array(ClaimIdSchema).max(200),
    supports: z.array(ClaimIdSchema).max(200),
    contradicts: z.array(ClaimIdSchema).max(200),
    qualitySignals: z.array(z.string().min(1).max(300)).max(50),
    applicabilityToBeacon: z.string().min(1).max(2000).nullable(),
    freshnessClass: FreshnessClassSchema,
    staleAfter: TimestampSchema.nullable(),
    excerptRef: z.string().min(1).max(500).nullable(),
    artifactHash: Sha256Schema.nullable(),
    notes: z.string().max(2000).nullable(),
  })
  .strict()
  .superRefine((evidence, ctx) => {
    const overlap = evidence.supports.filter((claimId) => evidence.contradicts.includes(claimId));
    if (overlap.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: "a claim cannot be both supported and contradicted by the same evidence record",
        path: ["contradicts"],
      });
    }
  });
export type Evidence = z.infer<typeof EvidenceSchema>;

export function validateSource(input: unknown): Source {
  return SourceSchema.parse(input);
}

export function validateEvidence(input: unknown): Evidence {
  return EvidenceSchema.parse(input);
}
