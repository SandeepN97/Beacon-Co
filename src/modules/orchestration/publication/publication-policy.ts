import {
  PublicationEvidenceSchema,
  type PublicationEvidence,
} from "../domain/publication-evidence.ts";

export const REQUIRED_PR_CHECKS = [
  "PR policy / metadata",
  "Agent platform / contracts-policy-evals",
  "PR quality / quality",
  "PR security / policy",
  "PR security / codeql",
  "PR accessibility and responsive / browser",
  "Dependency review / dependency-review",
] as const;

export interface PublicationDecision {
  ready: boolean;
  reasons: string[];
}

export function evaluatePublicationEvidence(input: unknown): PublicationDecision {
  const evidence: PublicationEvidence = PublicationEvidenceSchema.parse(input);
  const reasons: string[] = [];
  if (!evidence.author) reasons.push("Author run evidence is missing.");
  if (!evidence.qa) reasons.push("Independent QA evidence is missing.");
  if (evidence.reviews.length === 0) reasons.push("Independent review evidence is missing.");
  for (const run of [evidence.author, evidence.qa, ...evidence.reviews].filter(Boolean)) {
    if (run?.diffSha256 !== evidence.diffSha256)
      reasons.push(`Run ${run?.runId} is bound to a stale diff hash.`);
  }
  const byName = new Map(evidence.requiredChecks.map((check) => [check.name, check.status]));
  for (const required of REQUIRED_PR_CHECKS) {
    if (byName.get(required) !== "passed")
      reasons.push(`Required check is not passed: ${required}.`);
  }
  if (!evidence.externalAuthorityRecorded)
    reasons.push("External publication authority is not recorded.");
  const ready = reasons.length === 0;
  if (evidence.publicationReady !== ready)
    reasons.push("publicationReady does not match the deterministic gate result.");
  return { ready: reasons.length === 0 && ready, reasons };
}
