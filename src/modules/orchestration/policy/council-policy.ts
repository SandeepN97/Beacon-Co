import type { AgentRiskClass } from "../domain/agent-run.ts";
import {
  CouncilEvidenceSchema,
  type CouncilEvidence,
  type ReviewFinding,
} from "../domain/review.ts";

export interface CouncilRequirements {
  reviewLanes: number;
  crossProviderRequired: boolean;
  lenses: Array<"correctness-architecture" | "adversarial-security" | "operational-release">;
}

export interface CouncilDecision {
  disposition: "approved" | "blocked" | "human-decision-required" | "insufficient-evidence";
  reasons: string[];
  mergedFindings: ReviewFinding[];
}

const REQUIREMENTS: Record<AgentRiskClass, CouncilRequirements> = {
  "risk-0": { reviewLanes: 0, crossProviderRequired: false, lenses: [] },
  "risk-1": { reviewLanes: 1, crossProviderRequired: false, lenses: ["correctness-architecture"] },
  "risk-2": {
    reviewLanes: 2,
    crossProviderRequired: true,
    lenses: ["correctness-architecture", "adversarial-security"],
  },
  "risk-3": {
    reviewLanes: 3,
    crossProviderRequired: true,
    lenses: ["correctness-architecture", "adversarial-security", "operational-release"],
  },
};

export function councilRequirements(riskClass: AgentRiskClass): CouncilRequirements {
  const value = REQUIREMENTS[riskClass];
  return { ...value, lenses: [...value.lenses] };
}

export function mergeFindings(findings: ReviewFinding[]): ReviewFinding[] {
  const merged = new Map<string, ReviewFinding>();
  for (const finding of findings) {
    const key = `${finding.severity}:${finding.rootCause.trim().toLowerCase()}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...finding, evidence: [...finding.evidence] });
      continue;
    }
    existing.evidence = [...new Set([...existing.evidence, ...finding.evidence])].sort();
    existing.reproduced ||= finding.reproduced;
  }
  return [...merged.values()].sort((left, right) => left.id.localeCompare(right.id));
}

export function adjudicateCouncil(input: unknown): CouncilDecision {
  const evidence: CouncilEvidence = CouncilEvidenceSchema.parse(input);
  const requirements = councilRequirements(evidence.riskClass);
  const reasons: string[] = [];

  if (!evidence.deterministicChecksPassed) {
    return {
      disposition: "blocked",
      reasons: ["A deterministic required check failed."],
      mergedFindings: [],
    };
  }
  if (evidence.reviews.length < requirements.reviewLanes)
    reasons.push(`Risk tier requires ${requirements.reviewLanes} independent review lane(s).`);
  const reviewIds = new Set<string>();
  const sessions = new Set<string>();
  for (const review of evidence.reviews) {
    if (review.authorRunId !== evidence.authorRunId || review.reviewRunId === evidence.authorRunId)
      reasons.push("Reviewer evidence does not bind to an independent author/review run pair.");
    if (review.diffHash !== evidence.diffHash)
      reasons.push("Reviewer evidence is stale for the current diff hash.");
    if (!review.completedWithoutPeerOutputs)
      reasons.push("Reviewer output was not isolated from peer-review anchoring.");
    if (reviewIds.has(review.reviewRunId) || sessions.has(review.sessionId))
      reasons.push("Review run IDs and session IDs must be unique.");
    reviewIds.add(review.reviewRunId);
    sessions.add(review.sessionId);
  }
  if (
    requirements.crossProviderRequired &&
    evidence.reviews.length > 0 &&
    !evidence.reviews.some((review) => review.provider !== evidence.authorProvider)
  )
    reasons.push("Risk tier requires at least one cross-provider review lane.");
  if (reasons.length > 0)
    return {
      disposition: "insufficient-evidence",
      reasons: [...new Set(reasons)],
      mergedFindings: mergeFindings(evidence.reviews.flatMap((review) => review.findings)),
    };

  const findings = mergeFindings(evidence.reviews.flatMap((review) => review.findings));
  if (findings.some((finding) => finding.severity === "blocker")) {
    return {
      disposition: "blocked",
      reasons: ["A substantiated blocker cannot be waived by reviewer majority."],
      mergedFindings: findings,
    };
  }
  const unresolvedMajor = findings.some(
    (finding) =>
      finding.severity === "major" && (!finding.reproduced || finding.evidence.length === 0),
  );
  if (evidence.humanDecision === "rejected")
    return {
      disposition: "blocked",
      reasons: ["The accountable human rejected the change."],
      mergedFindings: findings,
    };
  if ((unresolvedMajor || evidence.productionRelease) && evidence.humanDecision !== "approved") {
    return {
      disposition: "human-decision-required",
      reasons: [
        unresolvedMajor
          ? "A major finding requires reproduction or fresh human adjudication."
          : "Production release requires an external human decision.",
      ],
      mergedFindings: findings,
    };
  }
  return {
    disposition: "approved",
    reasons: ["Required independent review evidence and deterministic checks passed."],
    mergedFindings: findings,
  };
}
