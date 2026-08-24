import { describe, expect, it } from "vitest";
import {
  assertValidAdrTransition,
  assertValidDecisionCandidateTransition,
  assertValidLearningPackageTransition,
  assertValidResearchThreadTransition,
  assertValidUnderstandingVersionTransition,
} from "../../src/modules/orchestration/decision-os/lifecycle.ts";

describe("ADR lifecycle guard (Section 25A / Figure 10D)", () => {
  it("allows proposed -> accepted", () => {
    expect(() => assertValidAdrTransition("proposed", "accepted")).not.toThrow();
  });

  it("allows accepted -> deprecated and accepted -> superseded", () => {
    expect(() => assertValidAdrTransition("accepted", "deprecated")).not.toThrow();
    expect(() => assertValidAdrTransition("accepted", "superseded")).not.toThrow();
  });

  it("rejects editing an accepted ADR (no accepted -> accepted transition, per INV-003)", () => {
    expect(() => assertValidAdrTransition("accepted", "accepted")).toThrow();
  });

  it("rejects skipping straight to accepted-adjacent states without proposal", () => {
    expect(() => assertValidAdrTransition("proposed", "deprecated")).toThrow();
    expect(() => assertValidAdrTransition("proposed", "superseded")).toThrow();
  });

  it("treats deprecated and superseded as terminal", () => {
    expect(() => assertValidAdrTransition("deprecated", "accepted")).toThrow();
    expect(() => assertValidAdrTransition("superseded", "accepted")).toThrow();
  });
});

describe("LearningPackage lifecycle guard (Section 25A / Figure 10E)", () => {
  it("allows the full forward path: draft -> evaluating -> trusted -> historical", () => {
    expect(() => assertValidLearningPackageTransition("draft", "evaluating")).not.toThrow();
    expect(() => assertValidLearningPackageTransition("evaluating", "trusted")).not.toThrow();
    expect(() => assertValidLearningPackageTransition("trusted", "historical")).not.toThrow();
  });

  it("rejects skipping the evaluating checkpoint (draft -> trusted)", () => {
    expect(() => assertValidLearningPackageTransition("draft", "trusted")).toThrow();
  });

  it("treats historical as terminal", () => {
    expect(() => assertValidLearningPackageTransition("historical", "draft")).toThrow();
  });
});

describe("ResearchThread lifecycle guard (Section 25A / Figure 10A)", () => {
  it("allows the forward path through decided", () => {
    expect(() => assertValidResearchThreadTransition("captured", "formalized")).not.toThrow();
    expect(() => assertValidResearchThreadTransition("formalized", "researching")).not.toThrow();
    expect(() => assertValidResearchThreadTransition("researching", "synthesized")).not.toThrow();
    expect(() =>
      assertValidResearchThreadTransition("synthesized", "decision-ready"),
    ).not.toThrow();
    expect(() => assertValidResearchThreadTransition("decision-ready", "decided")).not.toThrow();
  });

  it("allows the reopening path back into research after production evidence revises understanding", () => {
    expect(() => assertValidResearchThreadTransition("decided", "reopened")).not.toThrow();
    expect(() => assertValidResearchThreadTransition("reopened", "researching")).not.toThrow();
  });

  it("rejects skipping formalization straight to researching", () => {
    expect(() => assertValidResearchThreadTransition("captured", "researching")).toThrow();
  });
});

describe("UnderstandingVersion lifecycle guard (Section 25A / Figure 10B)", () => {
  it("allows the forward path: draft -> evaluated -> current -> superseded", () => {
    expect(() => assertValidUnderstandingVersionTransition("draft", "evaluated")).not.toThrow();
    expect(() => assertValidUnderstandingVersionTransition("evaluated", "current")).not.toThrow();
    expect(() => assertValidUnderstandingVersionTransition("current", "superseded")).not.toThrow();
  });

  it("rejects skipping evaluation (draft -> current)", () => {
    expect(() => assertValidUnderstandingVersionTransition("draft", "current")).toThrow();
  });

  it("treats superseded as terminal, preserving INV-005's addressability (superseding never re-transitions the old version further)", () => {
    expect(() => assertValidUnderstandingVersionTransition("superseded", "current")).toThrow();
  });
});

describe("DecisionCandidate lifecycle guard (Section 25A / Figure 10C)", () => {
  it("allows the forward path to either terminal outcome", () => {
    expect(() => assertValidDecisionCandidateTransition("draft", "researching")).not.toThrow();
    expect(() => assertValidDecisionCandidateTransition("researching", "ready")).not.toThrow();
    expect(() => assertValidDecisionCandidateTransition("ready", "accepted")).not.toThrow();
    expect(() => assertValidDecisionCandidateTransition("ready", "rejected")).not.toThrow();
  });

  it("rejects reaching accepted or rejected without going through ready (INV-002's boundary: ACCEPTED here only triggers ADRRequested, never authorizes execution itself)", () => {
    expect(() => assertValidDecisionCandidateTransition("draft", "accepted")).toThrow();
    expect(() => assertValidDecisionCandidateTransition("researching", "rejected")).toThrow();
  });

  it("treats accepted and rejected as terminal", () => {
    expect(() => assertValidDecisionCandidateTransition("accepted", "ready")).toThrow();
    expect(() => assertValidDecisionCandidateTransition("rejected", "ready")).toThrow();
  });
});
