import { z } from "astro/zod";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const GitShaSchema = z.string().regex(/^[a-f0-9]{40}$/);

export const DiffBoundRunSchema = z
  .object({
    runId: z.string().min(1).max(160),
    diffSha256: Sha256Schema,
  })
  .strict();

export const PublicationEvidenceSchema = z
  .object({
    schemaVersion: z.literal(2),
    repository: z.string().min(1).max(300),
    baseSha: GitShaSchema,
    headSha: GitShaSchema,
    diffSha256: Sha256Schema,
    generatedAt: z.iso.datetime({ offset: true }),
    prepublication: z
      .object({
        evidenceId: z.string().min(1).max(160),
        candidateSha: GitShaSchema,
        publicationReady: z.literal(true),
      })
      .strict()
      .nullable(),
    author: DiffBoundRunSchema.nullable(),
    qa: DiffBoundRunSchema.nullable(),
    reviews: z.array(DiffBoundRunSchema).max(3),
    requiredChecks: z.array(
      z
        .object({
          name: z.string().min(1).max(200),
          status: z.enum(["pending", "passed", "failed"]),
        })
        .strict(),
    ),
    externalAuthorityRecorded: z.boolean(),
    mergeReady: z.boolean(),
  })
  .strict();

export type PublicationEvidence = z.infer<typeof PublicationEvidenceSchema>;
