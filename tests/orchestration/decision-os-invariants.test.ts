import { describe, expect, it } from "vitest";
import {
  ARCHITECTURAL_INVARIANTS,
  assertAdrNotMutatedOnceAccepted,
  assertCapabilityWithinTrustTier,
  assertExecutionAuthorized,
  assertGateEvidenceRevalidated,
  assertNoRawProviderContextField,
  assertProviderEligibleForDataClassification,
  assertReleaseAuthorityRestrictedToPaidTier,
  dataClassificationEligibility,
  invariant,
} from "../../src/modules/orchestration/decision-os/invariants.ts";

describe("Section 1A invariant registry", () => {
  it("lists all twelve invariants from Section 1A's table", () => {
    expect(ARCHITECTURAL_INVARIANTS).toHaveLength(12);
  });

  it("marks exactly the seven PR-0A invariants Section 31 names as enforced", () => {
    const enforced = ARCHITECTURAL_INVARIANTS.filter((entry) => entry.enforcedInPR0A).map(
      (entry) => entry.id,
    );
    expect(enforced.sort()).toEqual(
      ["INV-001", "INV-002", "INV-003", "INV-006", "INV-007", "INV-008", "INV-010"].sort(),
    );
  });

  it("leaves the five deferred invariants unenforced, per Section 31's owning-PR rule", () => {
    const deferred = ARCHITECTURAL_INVARIANTS.filter((entry) => !entry.enforcedInPR0A).map(
      (entry) => entry.id,
    );
    expect(deferred.sort()).toEqual(["INV-004", "INV-005", "INV-009", "INV-011", "INV-012"].sort());
  });

  it("looks up a single invariant by id", () => {
    expect(invariant("INV-002").statement).toContain("Only an accepted ADR");
  });

  it("rejects an unknown invariant id", () => {
    expect(() => invariant("INV-099" as never)).toThrow();
  });
});

describe("INV-001: provider context must not become canonical memory", () => {
  it("passes a canonical-looking event payload shape", () => {
    expect(() =>
      assertNoRawProviderContextField({ provider: "claude", fiveHourUtilization: 0.5 }),
    ).not.toThrow();
  });

  it("rejects a shape carrying a raw provider-context field", () => {
    expect(() =>
      assertNoRawProviderContextField({ provider: "claude", rawProviderContext: "..." }),
    ).toThrow();
    expect(() => assertNoRawProviderContextField({ rawTranscript: "..." })).toThrow();
    expect(() => assertNoRawProviderContextField({ providerSessionId: "abc" })).toThrow();
  });
});

describe("INV-002: only an accepted ADR authorizes execution (reused from authority.ts)", () => {
  it("is the same function authority.ts already exports and tests", () => {
    const acceptedAdrRef = {
      schemaVersion: 1 as const,
      adrId: "0021-authorize-pr-0a-and-pr-0b",
      status: "accepted" as const,
      decisionCandidateRef: "candidate-1",
    };
    expect(assertExecutionAuthorized(acceptedAdrRef).status).toBe("accepted");
  });
});

describe("INV-003: an accepted ADR must not be mutated", () => {
  it("rejects an accepted -> accepted edit transition", () => {
    expect(() => assertAdrNotMutatedOnceAccepted("accepted", "accepted")).toThrow();
  });

  it("allows superseding an accepted ADR instead of editing it", () => {
    expect(() => assertAdrNotMutatedOnceAccepted("accepted", "superseded")).not.toThrow();
  });
});

describe("INV-006: ephemeral continuation state must be revalidated before use", () => {
  it("passes when evidence is bound to the current candidate", () => {
    expect(() =>
      assertGateEvidenceRevalidated(
        { gate: "unit", boundCandidateSha: "a".repeat(40) },
        "a".repeat(40),
      ),
    ).not.toThrow();
  });

  it("passes when evidence is not candidate-bound at all", () => {
    expect(() =>
      assertGateEvidenceRevalidated(
        { gate: "production-review", boundCandidateSha: null },
        "a".repeat(40),
      ),
    ).not.toThrow();
  });

  it("rejects trusting evidence bound to a stale candidate SHA", () => {
    expect(() =>
      assertGateEvidenceRevalidated(
        { gate: "prepublish", boundCandidateSha: "a".repeat(40) },
        "b".repeat(40),
      ),
    ).toThrow();
  });
});

describe("INV-007: provider eligibility evaluated against data classification (Section 27A)", () => {
  it("matches Section 27A's matrix cell-by-cell", () => {
    expect(dataClassificationEligibility("public", "experimental-t3")).toBe("eligible");
    expect(dataClassificationEligibility("internal", "vetted-free-t1-equivalent")).toBe(
      "policy-gated",
    );
    expect(dataClassificationEligibility("internal", "experimental-t3")).toBe("ineligible");
    expect(dataClassificationEligibility("confidential", "paid-trusted-t1")).toBe("approved-only");
    expect(dataClassificationEligibility("confidential", "vetted-free-t1-equivalent")).toBe(
      "ineligible",
    );
    expect(dataClassificationEligibility("secrets", "paid-trusted-t1")).toBe("ineligible");
    expect(dataClassificationEligibility("production-credentials", "paid-trusted-t1")).toBe(
      "role-controlled",
    );
    expect(
      dataClassificationEligibility("production-credentials", "vetted-free-t1-equivalent"),
    ).toBe("ineligible");
  });

  it("passes for a flatly eligible cell", () => {
    expect(() =>
      assertProviderEligibleForDataClassification("public", "vetted-free-t1-equivalent"),
    ).not.toThrow();
  });

  it("throws for a flatly ineligible cell (no downstream criterion can override it)", () => {
    expect(() =>
      assertProviderEligibleForDataClassification("secrets", "paid-trusted-t1"),
    ).toThrow();
    expect(() =>
      assertProviderEligibleForDataClassification("confidential", "experimental-t3"),
    ).toThrow();
  });

  it("does not throw for a gated-but-not-flatly-ineligible cell (caller must satisfy the named gate separately)", () => {
    expect(() =>
      assertProviderEligibleForDataClassification("internal", "vetted-free-t1-equivalent"),
    ).not.toThrow();
  });
});

describe("INV-008: an untrusted adapter must not receive capabilities above its trust tier (Section 29B.4)", () => {
  it("allows T1 full repo/production access", () => {
    expect(() => assertCapabilityWithinTrustTier("T1", "production-deploy")).not.toThrow();
  });

  it("allows T1-equivalent sandboxed write but not normal repo write", () => {
    expect(() => assertCapabilityWithinTrustTier("T1-equivalent", "sandboxed-write")).not.toThrow();
    expect(() => assertCapabilityWithinTrustTier("T1-equivalent", "normal-repo-write")).toThrow();
  });

  it("caps T3 at read-only", () => {
    expect(() => assertCapabilityWithinTrustTier("T3", "read-only")).not.toThrow();
    expect(() => assertCapabilityWithinTrustTier("T3", "sandboxed-write")).toThrow();
  });

  it("never allows T4 any capability, regardless of task class or capacity state", () => {
    expect(() => assertCapabilityWithinTrustTier("T4", "read-only")).toThrow();
  });
});

describe("INV-010: free-tier or experimental providers must not hold release authority (Section 29B.3)", () => {
  it("allows T1 (Claude/Codex, paid) release authority", () => {
    expect(() => assertReleaseAuthorityRestrictedToPaidTier("T1")).not.toThrow();
  });

  it("rejects every non-T1 tier, including the vetted free tier", () => {
    expect(() => assertReleaseAuthorityRestrictedToPaidTier("T1-equivalent")).toThrow();
    expect(() => assertReleaseAuthorityRestrictedToPaidTier("T2")).toThrow();
    expect(() => assertReleaseAuthorityRestrictedToPaidTier("T3")).toThrow();
    expect(() => assertReleaseAuthorityRestrictedToPaidTier("T4")).toThrow();
    expect(() => assertReleaseAuthorityRestrictedToPaidTier("T0")).toThrow();
  });
});
