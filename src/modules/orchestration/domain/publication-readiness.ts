import { z } from "astro/zod";

const GitShaSchema = z.string().regex(/^[a-f0-9]{40}$/);

export const PublicationGateStatusSchema = z.enum(["passed", "failed", "missing"]);

export const PublicationGateResultSchema = z
  .object({
    name: z.string().min(1).max(160),
    status: PublicationGateStatusSchema,
    command: z.string().min(1).max(500).nullable(),
    evidence: z.array(z.string().min(1).max(500)).max(20),
  })
  .strict();

export const PublicationReadinessEvidenceSchema = z
  .object({
    schemaVersion: z.literal(1),
    evidenceId: z.string().min(1).max(160),
    repository: z.string().min(1).max(300),
    branch: z.string().min(1).max(300),
    candidateSha: GitShaSchema,
    generatedAt: z.iso.datetime({ offset: true }),
    localReady: z.boolean(),
    publicationReady: z.boolean(),
    externalReady: z.boolean(),
    gates: z.array(PublicationGateResultSchema).min(1).max(100),
  })
  .strict();

export type PublicationGateResult = z.infer<typeof PublicationGateResultSchema>;
export type PublicationReadinessEvidence = z.infer<typeof PublicationReadinessEvidenceSchema>;

export interface PublicationReadinessDecision {
  ready: boolean;
  failedGates: string[];
  missingGates: string[];
  reasons: string[];
}

export function evaluatePublicationReadiness(
  gates: PublicationGateResult[],
): PublicationReadinessDecision {
  const failedGates = gates
    .filter((gate) => gate.status === "failed")
    .map((gate) => gate.name)
    .sort();
  const missingGates = gates
    .filter((gate) => gate.status === "missing")
    .map((gate) => gate.name)
    .sort();
  return {
    ready: failedGates.length === 0 && missingGates.length === 0,
    failedGates,
    missingGates,
    reasons: [
      ...failedGates.map((gate) => `Required publication gate failed: ${gate}.`),
      ...missingGates.map((gate) => `Required publication gate is missing: ${gate}.`),
    ],
  };
}

export function validatePublicationCandidate(
  input: unknown,
  candidateSha: string,
): PublicationReadinessDecision {
  const evidence = PublicationReadinessEvidenceSchema.parse(input);
  const decision = evaluatePublicationReadiness(evidence.gates);
  const reasons = [...decision.reasons];
  if (evidence.candidateSha !== candidateSha) {
    reasons.push(
      `Publication evidence is stale: ${evidence.candidateSha} does not match ${candidateSha}.`,
    );
  }
  if (!evidence.localReady) reasons.push("localReady is not true.");
  if (evidence.publicationReady !== decision.ready) {
    reasons.push("publicationReady does not match the deterministic publication gate result.");
  }
  return {
    ...decision,
    ready: reasons.length === 0 && evidence.localReady && evidence.publicationReady,
    reasons,
  };
}
