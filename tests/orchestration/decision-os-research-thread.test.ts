import { describe, expect, it } from "vitest";
import {
  validateQuestion,
  validateResearchThread,
} from "../../src/modules/orchestration/decision-os/research-thread.ts";

const threadBase = {
  schemaVersion: 1 as const,
  id: "thread-1",
  title: "Should Phase 1.6 add a durable event store?",
  originalThoughtRef: "prompt-1",
  formalizedQuestion: null,
  status: "open" as const,
  projectContextSnapshotRef: null,
  questionRefs: [],
  sourceRefs: [],
  evidenceRefs: [],
  claimRefs: [],
  alternativeRefs: [],
  experimentRefs: [],
  understandingVersionRefs: [],
  decisionCandidateRef: null,
  acceptedAdrRef: null,
  decisionPackageRef: null,
  executionRefs: [],
  outcomeRefs: [],
};

const questionBase = {
  schemaVersion: 1 as const,
  id: "question-1",
  threadId: "thread-1",
  type: "core" as const,
  text: "What does the master spec require of PR-0?",
  unknowns: [],
  decisionRelevance: null,
};

describe("decision-os research thread", () => {
  it("accepts a well-formed thread and defaults visibility to private", () => {
    const thread = validateResearchThread(threadBase);
    expect(thread.id).toBe("thread-1");
    expect(thread.visibility).toBe("private");
  });

  it("accepts an explicit visibility", () => {
    expect(validateResearchThread({ ...threadBase, visibility: "internal" }).visibility).toBe(
      "internal",
    );
  });

  it("accepts a valid ADR slug reference", () => {
    expect(
      validateResearchThread({ ...threadBase, acceptedAdrRef: "0019-begin-phase-1-6" })
        .acceptedAdrRef,
    ).toBe("0019-begin-phase-1-6");
  });

  it("rejects a malformed ADR slug reference", () => {
    expect(() => validateResearchThread({ ...threadBase, acceptedAdrRef: "not-a-slug" })).toThrow();
  });

  it("rejects an unknown field on the thread", () => {
    expect(() => validateResearchThread({ ...threadBase, extraField: "nope" })).toThrow();
  });

  it("accepts a well-formed question of each of the seven types", () => {
    for (const type of [
      "core",
      "current-state",
      "mechanism",
      "alternative",
      "evidence",
      "boundary",
      "decision",
    ]) {
      expect(validateQuestion({ ...questionBase, type }).type).toBe(type);
    }
  });

  it("rejects a question with an unknown type", () => {
    expect(() => validateQuestion({ ...questionBase, type: "off-topic" })).toThrow();
  });
});
