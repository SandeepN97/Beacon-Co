import { describe, expect, it } from "vitest";
import { validateReleaseEvidenceChain } from "../../src/modules/orchestration/publication/release-evidence-policy.ts";

const COMMIT = "a".repeat(40);
const ARTIFACT = "b".repeat(64);
const OLD_ARTIFACT = "c".repeat(64);
const base = {
  schemaVersion: 1,
  releaseId: `release-${COMMIT}`,
  recordedAt: "2026-08-09T12:00:00.000Z",
  commitSha: COMMIT,
  artifactSha256: ARTIFACT,
  passed: true,
  externalApproval: false,
  evidenceRef: "https://github.example/evidence",
  rollbackFromArtifactSha256: null,
};
const event = (
  type: string,
  environment: string | null,
  overrides: Record<string, unknown> = {},
) => ({ ...base, id: `${type}-${environment ?? "none"}`, type, environment, ...overrides });
const chain = [
  event("build", null),
  event("attestation", null),
  event("promotion", "staging"),
  event("verification", "staging"),
  event("approval", "production", { externalApproval: true }),
  event("promotion", "production"),
  event("verification", "production"),
  event("rollback", "production", {
    artifactSha256: OLD_ARTIFACT,
    rollbackFromArtifactSha256: ARTIFACT,
  }),
];

describe("release and rollback evidence", () => {
  it("accepts a complete build-once promotion and known-good rollback chain", () => {
    expect(validateReleaseEvidenceChain(chain)).toEqual({
      complete: true,
      reasons: [],
      releaseArtifactSha256: ARTIFACT,
    });
  });

  it("rejects independent production rebuild identity", () => {
    const changed = chain.map((entry) =>
      entry.type === "promotion" && entry.environment === "production"
        ? { ...entry, artifactSha256: "d".repeat(64) }
        : entry,
    );
    expect(validateReleaseEvidenceChain(changed).reasons).toContain(
      "Build, attestation, approval, promotion, and verification must bind to the same artifact.",
    );
  });

  it("requires signed attestation and both environment verifications", () => {
    const reduced = chain.filter(
      (entry) =>
        entry.type !== "attestation" &&
        !(entry.type === "verification" && entry.environment === "staging"),
    );
    const result = validateReleaseEvidenceChain(reduced);
    expect(result.reasons).toContain("A verified provenance attestation is required.");
    expect(result.reasons).toContain("A passing staging post-deploy verification is required.");
  });

  it("requires external production authority", () => {
    const reduced = chain.filter((entry) => entry.type !== "approval");
    expect(validateReleaseEvidenceChain(reduced).reasons).toContain(
      "External human-controlled production approval evidence is required.",
    );
  });

  it("does not treat redeploying the failed artifact as rollback", () => {
    const invalid = chain.map((entry) =>
      entry.type === "rollback" ? { ...entry, artifactSha256: ARTIFACT } : entry,
    );
    expect(validateReleaseEvidenceChain(invalid).reasons).toContain(
      "A passing known-good same-artifact rollback drill is required.",
    );
  });
});
