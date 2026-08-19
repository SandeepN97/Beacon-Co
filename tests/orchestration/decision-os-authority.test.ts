import { describe, expect, it } from "vitest";
import {
  assertExecutionAuthorized,
  defaultToPrivateVisibility,
} from "../../src/modules/orchestration/decision-os/authority.ts";

const acceptedAdrRef = {
  schemaVersion: 1 as const,
  adrId: "0019-begin-phase-1-6",
  status: "accepted" as const,
  decisionCandidateRef: "candidate-1",
};

describe("decision-os execution authority boundary", () => {
  it("accepts a real, accepted ADR reference", () => {
    expect(assertExecutionAuthorized(acceptedAdrRef).status).toBe("accepted");
  });

  it("rejects a requested (not yet accepted) ADR reference", () => {
    expect(() => assertExecutionAuthorized({ ...acceptedAdrRef, status: "requested" })).toThrow(
      'not "accepted"',
    );
  });

  it("rejects a superseded ADR reference", () => {
    expect(() => assertExecutionAuthorized({ ...acceptedAdrRef, status: "superseded" })).toThrow(
      'not "accepted"',
    );
  });

  it('rejects a Decision Candidate disposed "accept", however satisfied its readiness', () => {
    // Per Section 18/19: disposition "accept" only requests an ADR; it is
    // never itself authorization. A DecisionCandidate object doesn't even
    // have the AdrRef shape (no adrId/status), so it fails structurally.
    const fullyReadyCandidate = {
      schemaVersion: 1,
      id: "candidate-1",
      threadId: "thread-1",
      understandingVersionRef: "version-1",
      readiness: {
        problemDefined: true,
        currentStateVerified: true,
        primaryEvidencePresent: true,
        credibleAlternativesCompared: true,
        contradictionsHandled: true,
        securityConsidered: true,
        costComplexityConsidered: true,
        architectureImpactKnown: true,
        experimentDispositionKnown: true,
        revisitConditionsDefined: true,
        readyForAdr: true,
      },
      disposition: "accept",
      rejectionReason: null,
      reconsiderationTriggers: [],
    };
    expect(() => assertExecutionAuthorized(fullyReadyCandidate)).toThrow();
  });

  it("rejects a malformed ADR slug", () => {
    expect(() => assertExecutionAuthorized({ ...acceptedAdrRef, adrId: "not-a-slug" })).toThrow();
  });

  it("rejects an unrelated object", () => {
    expect(() => assertExecutionAuthorized({ note: "looks confident, isn't real" })).toThrow();
  });

  it("returns the validated AdrRef, not just a boolean", () => {
    expect(assertExecutionAuthorized(acceptedAdrRef)).toEqual(acceptedAdrRef);
  });
});

describe("decision-os private-by-default visibility", () => {
  it("defaults to private when no explicit value is given", () => {
    expect(defaultToPrivateVisibility()).toBe("private");
    expect(defaultToPrivateVisibility(undefined)).toBe("private");
    expect(defaultToPrivateVisibility(null)).toBe("private");
  });

  it("honors an explicit value verbatim, including an explicit private", () => {
    expect(defaultToPrivateVisibility("private")).toBe("private");
    expect(defaultToPrivateVisibility("internal")).toBe("internal");
    expect(defaultToPrivateVisibility("public")).toBe("public");
  });

  it("rejects an invalid explicit value rather than silently defaulting", () => {
    expect(() => defaultToPrivateVisibility("shared")).toThrow();
  });
});
