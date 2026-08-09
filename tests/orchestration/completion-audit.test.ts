import { describe, expect, it } from "vitest";
import { evaluatePhase15Completion } from "../../src/modules/orchestration/completion/completion-audit.ts";

describe("Phase 1.5 completion audit", () => {
  it("never emits the closure sentence while an external hard gate is missing", () => {
    const result = evaluatePhase15Completion({
      local: { contracts: true, policy: true },
      publication: { prepublication: true },
      external: { liveRun: false, productionApproval: false },
    });
    expect(result).toMatchObject({
      status: "in-progress",
      localReady: true,
      publicationReady: true,
      externalReady: false,
      closureSentence: null,
    });
  });

  it("reports local failures separately", () => {
    const result = evaluatePhase15Completion({
      local: { contracts: false, policy: true },
      publication: { prepublication: true },
      external: { liveRun: true },
    });
    expect(result.failedLocalGates).toEqual(["contracts"]);
    expect(result.failedExternalGates).toEqual([]);
    expect(result.failedPublicationGates).toEqual([]);
  });

  it("reports publication readiness independently from local and external readiness", () => {
    const result = evaluatePhase15Completion({
      local: { contracts: true },
      publication: { prepublication: false },
      external: { liveRun: false },
    });
    expect(result).toMatchObject({
      localReady: true,
      publicationReady: false,
      externalReady: false,
      failedPublicationGates: ["prepublication"],
    });
  });

  it("closes and freezes only when every gate passes", () => {
    const result = evaluatePhase15Completion({
      local: { contracts: true, policy: true },
      publication: { prepublication: true },
      external: { liveRun: true, productionApproval: true },
    });
    expect(result).toMatchObject({
      status: "complete-frozen",
      closureSentence: "Phase 1.5 closed. Beacon may proceed to the next business-domain/UI phase.",
    });
  });
});
