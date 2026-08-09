import { z } from "astro/zod";

const GitShaSchema = z.string().regex(/^[a-f0-9]{40}$/);
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const ReleaseEvidenceEventSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1).max(200),
    releaseId: z.string().min(1).max(200),
    type: z.enum(["build", "attestation", "approval", "promotion", "verification", "rollback"]),
    recordedAt: z.iso.datetime({ offset: true }),
    commitSha: GitShaSchema,
    artifactSha256: Sha256Schema,
    environment: z.enum(["preview", "staging", "production"]).nullable(),
    passed: z.boolean(),
    externalApproval: z.boolean(),
    evidenceRef: z.string().min(1).max(1000),
    rollbackFromArtifactSha256: Sha256Schema.nullable(),
  })
  .strict()
  .superRefine((event, context) => {
    if (
      event.type === "approval" &&
      (!event.externalApproval || event.environment !== "production")
    ) {
      context.addIssue({
        code: "custom",
        message: "approval evidence must represent an external production gate",
        path: ["externalApproval"],
      });
    }
    if (event.type === "rollback" && event.rollbackFromArtifactSha256 === null) {
      context.addIssue({
        code: "custom",
        message: "rollback evidence requires the replaced artifact identity",
        path: ["rollbackFromArtifactSha256"],
      });
    }
  });

export type ReleaseEvidenceEvent = z.infer<typeof ReleaseEvidenceEventSchema>;
