import { describe, expect, it } from "vitest";
import { classifyRisk } from "../../src/modules/orchestration/policy/risk-classifier.ts";
import {
  adjudicateCouncil,
  councilRequirements,
} from "../../src/modules/orchestration/policy/council-policy.ts";

const HASH = "e".repeat(64);

function evidence(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    workUnitId: "wu-1",
    authorRunId: "author-1",
    authorProvider: "codex",
    riskClass: "risk-2",
    diffHash: HASH,
    deterministicChecksPassed: true,
    productionRelease: false,
    reviews: [
      {
        authorRunId: "author-1",
        reviewRunId: "review-1",
        provider: "claude",
        sessionId: "session-1",
        lens: "correctness-architecture",
        diffHash: HASH,
        completedWithoutPeerOutputs: true,
        findings: [],
      },
      {
        authorRunId: "author-1",
        reviewRunId: "review-2",
        provider: "codex",
        sessionId: "session-2",
        lens: "adversarial-security",
        diffHash: HASH,
        completedWithoutPeerOutputs: true,
        findings: [],
      },
    ],
    humanDecision: null,
    ...overrides,
  };
}

describe("risk-tiered council policy", () => {
  it.each([
    [
      { paths: ["docs/readme.mdoc"], summary: "docs-only wording", workflowType: "documentation" },
      "risk-0",
    ],
    [
      { paths: ["src/a.ts"], summary: "ordinary UI behavior", workflowType: "implementation" },
      "risk-1",
    ],
    [
      {
        paths: [".github/workflows/pr.yml"],
        summary: "workflow change",
        workflowType: "implementation",
      },
      "risk-2",
    ],
    [
      { paths: ["src/auth.ts"], summary: "authorization boundary", workflowType: "implementation" },
      "risk-3",
    ],
  ])("classifies risk deterministically", (input, expected) => {
    expect(classifyRisk(input as Parameters<typeof classifyRisk>[0])).toBe(expected);
  });

  it("sets review lanes by risk", () => {
    expect(
      ["risk-0", "risk-1", "risk-2", "risk-3"].map(
        (risk) => councilRequirements(risk as never).reviewLanes,
      ),
    ).toEqual([0, 1, 2, 3]);
  });

  it("approves complete independent risk-2 evidence", () => {
    expect(adjudicateCouncil(evidence()).disposition).toBe("approved");
  });

  it("never lets a majority waive one blocker", () => {
    const base = evidence();
    const reviews = (base.reviews as Array<Record<string, unknown>>).map((review, index) =>
      index === 0
        ? {
            ...review,
            findings: [
              {
                id: "finding-1",
                severity: "blocker",
                rootCause: "Authorization bypass",
                evidence: ["test:auth-bypass"],
                reproduced: true,
              },
            ],
          }
        : review,
    );
    expect(adjudicateCouncil({ ...base, reviews }).disposition).toBe("blocked");
  });

  it("blocks deterministic failures before voting", () => {
    expect(adjudicateCouncil(evidence({ deterministicChecksPassed: false })).disposition).toBe(
      "blocked",
    );
  });

  it("requires unique independent runs, current diff, isolation, and cross-provider evidence", () => {
    const base = evidence();
    const repeated = {
      ...(base.reviews as Array<Record<string, unknown>>)[0],
      provider: "codex",
      reviewRunId: "author-1",
      sessionId: "session-1",
      diffHash: "f".repeat(64),
      completedWithoutPeerOutputs: false,
    };
    expect(adjudicateCouncil({ ...base, reviews: [repeated, repeated] })).toMatchObject({
      disposition: "insufficient-evidence",
    });
  });

  it("requires human adjudication for an unresolved major", () => {
    const base = evidence();
    const reviews = (base.reviews as Array<Record<string, unknown>>).map((review, index) =>
      index === 0
        ? {
            ...review,
            findings: [
              {
                id: "finding-major",
                severity: "major",
                rootCause: "Unverified failure",
                evidence: [],
                reproduced: false,
              },
            ],
          }
        : review,
    );
    expect(adjudicateCouncil({ ...base, reviews }).disposition).toBe("human-decision-required");
    expect(adjudicateCouncil({ ...base, reviews, humanDecision: "approved" }).disposition).toBe(
      "approved",
    );
  });

  it("requires an external decision for production", () => {
    expect(adjudicateCouncil(evidence({ productionRelease: true })).disposition).toBe(
      "human-decision-required",
    );
  });
});
