import { z } from "astro/zod";

const GitShaSchema = z.string().regex(/^[a-f0-9]{40}$/);
// Git tree object IDs share the same 40-hex-char shape as commit IDs; this
// alias exists purely to make schema fields self-documenting about which
// kind of git object identity is being represented (content-addressed tree
// vs. commit).
const GitTreeShaSchema = GitShaSchema;

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
    candidateTree: GitTreeShaSchema,
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
  candidateTree: string,
): PublicationReadinessDecision {
  const evidence = PublicationReadinessEvidenceSchema.parse(input);
  const decision = evaluatePublicationReadiness(evidence.gates);
  const reasons = [...decision.reasons];
  // Content-addressed comparison: GitHub always server-generates a new
  // commit SHA on merge, so exact commit-SHA equality between
  // prepublication evidence and the merged main HEAD can never hold. The
  // git tree hash instead identifies the exact file content, which is
  // preserved by a normal merge and only changes when the actual content
  // changes — so this remains a strict content-identity guarantee, not a
  // relaxation to commit lineage ("ancestor of") laxity.
  if (evidence.candidateTree !== candidateTree) {
    reasons.push(
      `Publication evidence tree is stale: ${evidence.candidateTree} (from commit ${evidence.candidateSha}) does not match ${candidateTree} (from commit ${candidateSha}).`,
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
