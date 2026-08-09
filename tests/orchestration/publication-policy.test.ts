import { describe, expect, it } from "vitest";
import {
  evaluatePublicationEvidence,
  REQUIRED_PR_CHECKS,
} from "../../src/modules/orchestration/publication/publication-policy.ts";

const DIFF = "a".repeat(64);
const evidence = {
  schemaVersion: 2,
  repository: "Beacon/Co",
  baseSha: "b".repeat(40),
  headSha: "c".repeat(40),
  diffSha256: DIFF,
  generatedAt: "2026-08-09T12:00:00.000Z",
  prepublication: {
    evidenceId: "prepublish-1",
    candidateSha: "c".repeat(40),
    publicationReady: true as const,
  },
  author: { runId: "author-1", diffSha256: DIFF },
  qa: { runId: "qa-1", diffSha256: DIFF },
  reviews: [{ runId: "review-1", diffSha256: DIFF }],
  requiredChecks: REQUIRED_PR_CHECKS.map((name) => ({ name, status: "passed" as const })),
  externalAuthorityRecorded: true,
  mergeReady: true,
};

describe("diff-bound publication policy", () => {
  it("passes a complete dry-run publication package", () => {
    expect(evaluatePublicationEvidence(evidence)).toEqual({ ready: true, reasons: [] });
  });

  it("rejects stale author, QA, or review evidence", () => {
    const stale = {
      ...evidence,
      qa: { runId: "qa-1", diffSha256: "d".repeat(64) },
      mergeReady: false,
    };
    expect(evaluatePublicationEvidence(stale)).toMatchObject({
      ready: false,
      reasons: ["Run qa-1 is bound to a stale diff hash."],
    });
  });

  it("requires every uniquely named server-side check", () => {
    const failed = {
      ...evidence,
      requiredChecks: evidence.requiredChecks.map((check) =>
        check.name === "PR security / codeql" ? { ...check, status: "failed" as const } : check,
      ),
      mergeReady: false,
    };
    expect(evaluatePublicationEvidence(failed).reasons).toContain(
      "Required check is not passed: PR security / codeql.",
    );
  });

  it("requires external publication authority", () => {
    expect(
      evaluatePublicationEvidence({
        ...evidence,
        externalAuthorityRecorded: false,
        mergeReady: false,
      }).reasons,
    ).toContain("External publication authority is not recorded.");
  });

  it("rejects a self-declared ready flag that does not match evidence", () => {
    const result = evaluatePublicationEvidence({
      ...evidence,
      reviews: [],
      mergeReady: true,
    });
    expect(result.ready).toBe(false);
    expect(result.reasons).toContain(
      "mergeReady does not match the deterministic merge gate result.",
    );
  });

  it("rejects missing or stale prepublication readiness", () => {
    expect(
      evaluatePublicationEvidence({ ...evidence, prepublication: null, mergeReady: false }).reasons,
    ).toContain("Prepublication readiness evidence is missing.");
    expect(
      evaluatePublicationEvidence({
        ...evidence,
        prepublication: { ...evidence.prepublication, candidateSha: "d".repeat(40) },
        mergeReady: false,
      }).reasons,
    ).toContain("Prepublication readiness evidence is bound to a stale candidate SHA.");
  });
});
