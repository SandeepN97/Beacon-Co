import { describe, expect, it } from "vitest";
import { ContinuationManager } from "../../src/modules/orchestration/broker/continuation-manager";
import { ContextRetriever } from "../../src/modules/orchestration/knowledge/context-retriever";
import { IntentTranslator } from "../../src/modules/orchestration/translator/intent-translator";
import type { WorkUnit } from "../../src/modules/orchestration/domain/work-unit";
import { documents } from "./fixtures";

describe("provider-neutral continuation", () => {
  it("contains every required field so fallback does not need raw chat reconstruction", () => {
    const request = new IntentTranslator(new ContextRetriever(documents)).translate(
      "use codex to implement a small docs search fix",
    ).request;
    const workUnit: WorkUnit = {
      id: request.id,
      request,
      goal: request.normalizedGoal,
      acceptanceCriteria: request.acceptanceCriteria,
      constraints: request.constraints,
      risk: request.risk,
      dependencies: request.dependencies,
      status: "repair",
      assignedProvider: "codex",
      authorSessionId: "codex-1",
      retryCount: 1,
    };
    const manager = new ContinuationManager();
    const value = manager.create(workUnit, {
      approvedMarkdocContext: request.relevantDocs,
      acceptedAdrConstraints: request.relevantAdrs,
      filesInspected: ["src/pages/docs/[...slug].astro"],
      filesChanged: ["src/styles/docs.css"],
      currentDiffRef: "git:diff-sha256:abc123",
      commandsRun: ["npm run test"],
      testEvidence: ["18 tests passed"],
      decisionsMade: ["Preserve static output"],
      openBlockers: [],
      requiredNextAction: "Run the production build.",
      stopCondition: "Stop if the build fails outside the approved scope.",
      publicationState: {
        localReady: true,
        publicationReady: false,
        externalReady: false,
        requiredGates: [
          { name: "unit", tier: "local", candidateShaBound: true },
          { name: "prepublish", tier: "publication", candidateShaBound: true },
          { name: "production-review", tier: "external", candidateShaBound: false },
        ],
        completedGates: ["unit"],
        failedGates: [],
        outstandingGates: ["prepublish", "production-review"],
        evidenceRefs: [
          { id: "unit-evidence", gate: "unit", candidateSha: "a".repeat(40) },
          { id: "ruleset-evidence", gate: "production-review", candidateSha: null },
        ],
        branch: "phase15-closure-hardening",
        candidateSha: "a".repeat(40),
        prNumber: null,
        nextAuthorizedAction: "Run prepublication.",
      },
    });
    expect(manager.validate(value)).toEqual([]);
    expect(value.originalUserRequest).toBe(request.rawRequest);
    expect(value.assumptions).toEqual(request.assumptions);
  });

  it("preserves outstanding publication state across providers without repeating fresh evidence", () => {
    const request = new IntentTranslator(new ContextRetriever(documents)).translate(
      "continue the approved publication",
    ).request;
    const workUnit: WorkUnit = {
      id: request.id,
      request,
      goal: request.normalizedGoal,
      acceptanceCriteria: request.acceptanceCriteria,
      constraints: request.constraints,
      risk: request.risk,
      dependencies: request.dependencies,
      status: "routed",
      assignedProvider: "claude",
      authorSessionId: "claude-1",
      retryCount: 0,
    };
    const manager = new ContinuationManager();
    const value = manager.create(workUnit, {
      approvedMarkdocContext: [],
      acceptedAdrConstraints: [],
      filesInspected: [],
      filesChanged: [],
      currentDiffRef: "git:diff-sha256:def456",
      commandsRun: [],
      testEvidence: [],
      decisionsMade: [],
      openBlockers: ["production-review"],
      requiredNextAction: "Continue with Codex.",
      stopCondition: "Stop at production approval.",
      publicationState: {
        localReady: true,
        publicationReady: true,
        externalReady: false,
        requiredGates: [
          { name: "prepublish", tier: "publication", candidateShaBound: true },
          { name: "production-review", tier: "external", candidateShaBound: false },
        ],
        completedGates: ["prepublish"],
        failedGates: [],
        outstandingGates: ["production-review"],
        evidenceRefs: [{ id: "prepublish-a", gate: "prepublish", candidateSha: "a".repeat(40) }],
        branch: "phase15-closure-hardening",
        candidateSha: "a".repeat(40),
        prNumber: 32,
        nextAuthorizedAction: "Await production reviewer.",
      },
    });

    expect(manager.forCandidate(value, "a".repeat(40))).toBe(value);
    expect(value.publicationState.outstandingGates).toEqual(["production-review"]);

    const invalidated = manager.forCandidate(value, "b".repeat(40));
    expect(invalidated.publicationState).toMatchObject({
      localReady: true,
      publicationReady: false,
      externalReady: false,
      completedGates: [],
      outstandingGates: ["prepublish", "production-review"],
    });
    expect(invalidated.publicationState.evidenceRefs).toEqual([]);
  });
});
