import { describe, expect, it } from "vitest";
import { validateClaim } from "../../src/modules/orchestration/decision-os/claim.ts";

const base = {
  schemaVersion: 1 as const,
  id: "claim-1",
  normalizedClaim: "Astro static output does not require an SSR adapter.",
  status: "supported" as const,
  supportingEvidenceRefs: ["evidence-1"],
  contradictingEvidenceRefs: [],
  boundaryConditions: [],
  confidenceBasis: null,
  applicabilityToBeacon: null,
  supersedesClaimRef: null,
  revalidationTriggers: [],
  relatedConceptRefs: [],
};

describe("decision-os claim invariants", () => {
  it("accepts a well-formed supported claim", () => {
    expect(validateClaim(base).id).toBe("claim-1");
  });

  it("rejects the same evidence both supporting and contradicting a claim", () => {
    expect(() =>
      validateClaim({
        ...base,
        supportingEvidenceRefs: ["evidence-1"],
        contradictingEvidenceRefs: ["evidence-1"],
      }),
    ).toThrow("the same evidence cannot both support and contradict one claim");
  });

  it('rejects status "contested" without contradicting evidence', () => {
    expect(() =>
      validateClaim({ ...base, status: "contested", contradictingEvidenceRefs: [] }),
    ).toThrow(
      "requires at least one contradicting evidence reference (Section 10.1 anti-confirmation rule)",
    );
  });

  it('accepts status "contested" when contradicting evidence is present', () => {
    expect(
      validateClaim({ ...base, status: "contested", contradictingEvidenceRefs: ["evidence-2"] })
        .status,
    ).toBe("contested");
  });

  it("rejects an unknown field", () => {
    expect(() => validateClaim({ ...base, extraField: "nope" })).toThrow();
  });
});
