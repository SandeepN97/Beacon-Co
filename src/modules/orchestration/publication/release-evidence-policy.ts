import {
  ReleaseEvidenceEventSchema,
  type ReleaseEvidenceEvent,
} from "../domain/release-evidence.ts";

export interface ReleaseEvidenceDecision {
  complete: boolean;
  reasons: string[];
  releaseArtifactSha256: string | null;
}

export function validateReleaseEvidenceChain(input: unknown): ReleaseEvidenceDecision {
  if (!Array.isArray(input)) throw new TypeError("Release evidence chain must be an array.");
  const events: ReleaseEvidenceEvent[] = input.map((event) =>
    ReleaseEvidenceEventSchema.parse(event),
  );
  const reasons: string[] = [];
  const builds = events.filter((event) => event.type === "build" && event.passed);
  if (builds.length !== 1) reasons.push("Exactly one passing build event is required.");
  const artifact = builds[0]?.artifactSha256 ?? null;
  const commit = builds[0]?.commitSha ?? null;
  const releaseId = builds[0]?.releaseId ?? null;
  if (
    releaseId &&
    events
      .filter((event) => event.type !== "rollback")
      .some((event) => event.releaseId !== releaseId)
  )
    reasons.push("Every non-rollback event must share the build releaseId.");
  if (
    artifact &&
    events
      .filter((event) => event.type !== "rollback")
      .some((event) => event.artifactSha256 !== artifact)
  )
    reasons.push(
      "Build, attestation, approval, promotion, and verification must bind to the same artifact.",
    );
  if (
    commit &&
    events.filter((event) => event.type !== "rollback").some((event) => event.commitSha !== commit)
  )
    reasons.push("Every build/promotion event must bind to the same reviewed commit.");
  if (!events.some((event) => event.type === "attestation" && event.passed))
    reasons.push("A verified provenance attestation is required.");
  for (const environment of ["staging", "production"] as const) {
    if (
      !events.some(
        (event) => event.type === "promotion" && event.environment === environment && event.passed,
      )
    )
      reasons.push(`A passing ${environment} promotion is required.`);
    if (
      !events.some(
        (event) =>
          event.type === "verification" && event.environment === environment && event.passed,
      )
    )
      reasons.push(`A passing ${environment} post-deploy verification is required.`);
  }
  if (
    !events.some(
      (event) =>
        event.type === "approval" &&
        event.environment === "production" &&
        event.externalApproval &&
        event.passed,
    )
  )
    reasons.push("External human-controlled production approval evidence is required.");
  if (
    !events.some(
      (event) =>
        event.type === "rollback" &&
        event.environment === "production" &&
        event.passed &&
        event.rollbackFromArtifactSha256 !== event.artifactSha256,
    )
  )
    reasons.push("A passing known-good same-artifact rollback drill is required.");
  return { complete: reasons.length === 0, reasons, releaseArtifactSha256: artifact };
}
