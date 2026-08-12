import { describe, expect, it } from "vitest";
import {
  validateAdrRef,
  validateDecisionCandidate,
  validateDecisionPackage,
  validateDecisionReadiness,
} from "../../src/modules/orchestration/decision-os/decision.ts";

const notReady = {
  problemDefined: true,
  currentStateVerified: true,
  primaryEvidencePresent: true,
  credibleAlternativesCompared: true,
  contradictionsHandled: true,
  securityConsidered: true,
  costComplexityConsidered: true,
  architectureImpactKnown: true,
  experimentDispositionKnown: true,
  revisitConditionsDefined: false,
  readyForAdr: false,
};
const fullyReady = { ...notReady, revisitConditionsDefined: true, readyForAdr: true };

const candidateBase = {
  schemaVersion: 1 as const,
  id: "candidate-1",
  threadId: "thread-1",
  understandingVersionRef: "version-1",
  readiness: notReady,
  disposition: null,
  rejectionReason: null,
  reconsiderationTriggers: [],
};

const packageBase = {
  schemaVersion: 1 as const,
  id: "package-1",
  adrId: "0019-begin-phase-1-6",
  objective: "Authorize PR-0.",
  acceptanceCriteria: ["Schemas and events land with unit tests."],
  invariants: [],
  constraints: [],
  securityRequirements: [],
  risk: "low" as const,
  architectureRefs: [],
  documentationRefs: [],
  evidenceRefs: [],
  unresolvedRisks: [],
  revisitConditions: [],
};

describe("decision-os decision readiness", () => {
  it("accepts readiness with readyForAdr false regardless of other dimensions", () => {
    expect(validateDecisionReadiness(notReady).readyForAdr).toBe(false);
  });

  it("accepts readyForAdr true only once every dimension is true", () => {
    expect(validateDecisionReadiness(fullyReady).readyForAdr).toBe(true);
  });

  it("rejects readyForAdr true while any other dimension is false", () => {
    expect(() => validateDecisionReadiness({ ...notReady, readyForAdr: true })).toThrow(
      "readyForAdr cannot be true unless every other readiness dimension is true too",
    );
  });
});

describe("decision-os decision candidate", () => {
  it('rejects disposition "accept" unless readiness.readyForAdr is true', () => {
    expect(() =>
      validateDecisionCandidate({ ...candidateBase, disposition: "accept", readiness: notReady }),
    ).toThrow("unless readiness.readyForAdr is true");
  });

  it('accepts disposition "accept" once readiness.readyForAdr is true', () => {
    expect(
      validateDecisionCandidate({ ...candidateBase, disposition: "accept", readiness: fullyReady })
        .disposition,
    ).toBe("accept");
  });

  it('rejects disposition "reject" without a rejectionReason', () => {
    expect(() =>
      validateDecisionCandidate({ ...candidateBase, disposition: "reject", rejectionReason: null }),
    ).toThrow("requires a rejectionReason");
  });

  it('accepts disposition "reject" with a rejectionReason', () => {
    expect(
      validateDecisionCandidate({
        ...candidateBase,
        disposition: "reject",
        rejectionReason: "Evidence is too thin.",
      }).disposition,
    ).toBe("reject");
  });
});

describe("decision-os ADR reference and decision package", () => {
  it("accepts a valid ADR slug reference", () => {
    expect(
      validateAdrRef({
        schemaVersion: 1,
        adrId: "0019-begin-phase-1-6",
        status: "accepted",
        decisionCandidateRef: "candidate-1",
      }).status,
    ).toBe("accepted");
  });

  it("rejects a malformed ADR slug", () => {
    expect(() =>
      validateAdrRef({
        schemaVersion: 1,
        adrId: "not-a-slug",
        status: "accepted",
        decisionCandidateRef: "candidate-1",
      }),
    ).toThrow();
  });

  it("accepts a well-formed decision package", () => {
    expect(validateDecisionPackage(packageBase).adrId).toBe("0019-begin-phase-1-6");
  });

  it("requires at least one acceptance criterion", () => {
    expect(() => validateDecisionPackage({ ...packageBase, acceptanceCriteria: [] })).toThrow();
  });
});
