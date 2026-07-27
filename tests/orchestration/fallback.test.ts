import { describe, expect, it } from "vitest";
import { CapacityManager } from "../../src/modules/orchestration/broker/capacity-manager";
import { ProviderRouter } from "../../src/modules/orchestration/broker/router";

const requiredTools = ["repository-read", "structured-output", "simulation"];

describe("capacity fallback", () => {
  it("falls back from Claude to Codex without changing the request", () => {
    const capacity = new CapacityManager({ claude: { manualCapacity: 0 } });
    const decision = new ProviderRouter(capacity).route({
      workflowType: "documentation",
      dataClassification: "internal",
      preferredProvider: "claude",
      requiredTools,
    });
    expect(decision.provider).toBe("codex");
    expect(decision.fallbackUsed).toBe(true);
  });

  it("falls back from Codex to Claude", () => {
    const capacity = new CapacityManager({ codex: { manualCapacity: 0 } });
    const decision = new ProviderRouter(capacity).route({
      workflowType: "implementation",
      dataClassification: "internal",
      preferredProvider: "codex",
      requiredTools,
    });
    expect(decision.provider).toBe("claude");
    expect(decision.fallbackUsed).toBe(true);
  });
});
