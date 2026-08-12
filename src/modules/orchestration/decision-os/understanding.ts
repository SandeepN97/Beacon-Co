import { z } from "astro/zod";
import {
  ClaimIdSchema,
  EvidenceIdSchema,
  MentalModelIdSchema,
  ResearchThreadIdSchema,
  UnderstandingCheckIdSchema,
  UnderstandingVersionIdSchema,
} from "./ids.ts";

const TimestampSchema = z.iso.datetime({ offset: true });
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

/**
 * Section 11's UnderstandingVersion. History is an asset: superseding an earlier
 * version creates a new record with `supersedesVersionRef` set, rather than mutating
 * the old one (Section 9: "Never silently rewrite the old one").
 */
export const UnderstandingVersionSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: UnderstandingVersionIdSchema,
    threadId: ResearchThreadIdSchema,
    createdAt: TimestampSchema,
    summary30s: z.string().min(1).max(1000),
    coreMechanism: z.string().min(1).max(4000),
    deepModelRef: z.string().min(1).max(500).nullable(),
    mentalModelRefs: z.array(MentalModelIdSchema).max(50),
    boundaryConditions: z.array(z.string().min(1).max(1000)).max(50),
    contradictionRefs: z.array(ClaimIdSchema).max(100),
    unresolvedQuestions: z.array(z.string().min(1).max(1000)).max(50),
    observableUnderstandingChecks: z.array(UnderstandingCheckIdSchema).max(50),
    derivedFromEvidenceRefs: z.array(EvidenceIdSchema).max(500),
    evidenceSetHash: Sha256Schema,
    projectContextHash: Sha256Schema,
    supersedesVersionRef: UnderstandingVersionIdSchema.nullable(),
  })
  .strict();
export type UnderstandingVersion = z.infer<typeof UnderstandingVersionSchema>;

/** Section 16's authority rule: canonical only once promoted through an accepted ADR. */
export const MentalModelAuthoritySchema = z.enum(["explanatory", "exploratory", "canonical"]);
export type MentalModelAuthority = z.infer<typeof MentalModelAuthoritySchema>;

/** Section 15/16's representation canon. */
export const MentalModelRepresentationTypeSchema = z.enum([
  "markmap",
  "mermaid",
  "excalidraw",
  "beacon-native",
  "bounded-simulation",
  "text",
]);
export type MentalModelRepresentationType = z.infer<typeof MentalModelRepresentationTypeSchema>;

export const MentalModelSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: MentalModelIdSchema,
    conceptRef: z.string().min(1).max(300),
    understandingVersionRef: UnderstandingVersionIdSchema,
    learningPurpose: z.string().min(1).max(500),
    representationType: MentalModelRepresentationTypeSchema,
    renderer: z.string().min(1).max(200),
    sourceSpecRef: z.string().min(1).max(500),
    accessibilityContract: z.string().min(1).max(1000),
    authority: MentalModelAuthoritySchema,
  })
  .strict()
  .superRefine((model, ctx) => {
    if (model.authority === "canonical" && model.representationType === "excalidraw") {
      ctx.addIssue({
        code: "custom",
        message:
          'Excalidraw views are "always exploratory until promoted through an accepted decision" (Section 16); authority cannot be "canonical" without that promotion having produced a Mermaid/beacon-native canonical view instead',
        path: ["authority"],
      });
    }
  });
export type MentalModel = z.infer<typeof MentalModelSchema>;

/** Section 17's observable-understanding-check table: never collapse into a score. */
export const UnderstandingCheckStateSchema = z.enum(["yes", "no", "unknown"]);
export type UnderstandingCheckState = z.infer<typeof UnderstandingCheckStateSchema>;

export const UnderstandingCheckKindSchema = z.enum([
  "identify-core-components",
  "explain-simply",
  "predict-behavior",
  "distinguish-alternatives",
  "identify-boundary-cases",
  "apply-to-new-case",
  "explain-rejected-option",
]);
export type UnderstandingCheckKind = z.infer<typeof UnderstandingCheckKindSchema>;

export const UnderstandingCheckSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: UnderstandingCheckIdSchema,
    understandingVersionRef: UnderstandingVersionIdSchema,
    kind: UnderstandingCheckKindSchema,
    state: UnderstandingCheckStateSchema,
  })
  .strict();
export type UnderstandingCheck = z.infer<typeof UnderstandingCheckSchema>;

/** Section 13's Understanding Compiler output. */
export const UnderstandingPackageSchema = z
  .object({
    schemaVersion: z.literal(1),
    conceptRef: z.string().min(1).max(300),
    understandingVersionRef: UnderstandingVersionIdSchema,
    summary30s: z.string().min(1).max(1000),
    prerequisiteRefs: z.array(z.string().min(1).max(300)).max(50),
    mechanism: z.string().min(1).max(4000),
    boundaryConditions: z.array(z.string().min(1).max(1000)).max(50),
    recommendedVisuals: z.array(MentalModelIdSchema).max(20),
    interactionSpec: z.string().max(2000).nullable(),
    activeChecks: z.array(UnderstandingCheckIdSchema).max(50),
    contradictionRefs: z.array(ClaimIdSchema).max(100),
    evidenceRefs: z.array(EvidenceIdSchema).max(500),
    deepReferenceRefs: z.array(z.string().min(1).max(500)).max(50),
  })
  .strict();
export type UnderstandingPackage = z.infer<typeof UnderstandingPackageSchema>;

export function validateUnderstandingVersion(input: unknown): UnderstandingVersion {
  return UnderstandingVersionSchema.parse(input);
}

export function validateMentalModel(input: unknown): MentalModel {
  return MentalModelSchema.parse(input);
}

export function validateUnderstandingCheck(input: unknown): UnderstandingCheck {
  return UnderstandingCheckSchema.parse(input);
}

export function validateUnderstandingPackage(input: unknown): UnderstandingPackage {
  return UnderstandingPackageSchema.parse(input);
}
