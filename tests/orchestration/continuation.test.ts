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
      currentDiff: "diff --git a/src/styles/docs.css",
      commandsRun: ["npm run test"],
      testEvidence: ["18 tests passed"],
      decisionsMade: ["Preserve static output"],
      openBlockers: [],
      requiredNextAction: "Run the production build.",
      stopCondition: "Stop if the build fails outside the approved scope.",
    });
    expect(manager.validate(value)).toEqual([]);
    expect(value.originalUserRequest).toBe(request.rawRequest);
    expect(value.assumptions).toEqual(request.assumptions);
  });
});
