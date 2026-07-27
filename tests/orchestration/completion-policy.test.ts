import { describe, expect, it } from "vitest";
import {
  mayComplete,
  type CompletionInput,
} from "../../src/modules/orchestration/workflows/completion-policy";

const passingInput = (): CompletionInput => ({
  gates: [
    {
      name: "unit tests",
      passed: true,
      evidence: "17 tests passed",
      blocking: true,
    },
  ],
  votes: [
    {
      reviewerId: "reviewer-a",
      provider: "claude",
      sessionId: "claude-review-1",
      approved: true,
      blockers: [],
      acceptanceEvidence: ["criterion-1"],
    },
    {
      reviewerId: "reviewer-b",
      provider: "codex",
      sessionId: "codex-review-1",
      approved: true,
      blockers: [],
      acceptanceEvidence: ["criterion-2"],
    },
  ],
  authorSessionId: "codex-author-1",
  unresolvedBlockers: [],
  acceptanceCriteriaCount: 2,
  requiredApprovalsComplete: true,
});

describe("completion policy", () => {
  it("allows completion only with deterministic evidence and two independent approvals", () => {
    expect(mayComplete(passingInput())).toBe(true);
  });

  it("does not let model confidence or review votes overrule a failed blocking gate", () => {
    const input = passingInput();
    input.gates[0].passed = false;
    expect(mayComplete(input)).toBe(false);
  });

  it("rejects author self-approval and duplicate votes from one session", () => {
    const input = passingInput();
    input.votes = [
      {
        ...input.votes[0],
        sessionId: input.authorSessionId,
      },
      {
        ...input.votes[1],
        sessionId: "one-independent-session",
      },
      {
        ...input.votes[1],
        reviewerId: "duplicate-reviewer",
        sessionId: "one-independent-session",
      },
    ];
    expect(mayComplete(input)).toBe(false);
  });
});
