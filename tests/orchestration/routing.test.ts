import { describe, expect, it } from "vitest";
import { CapacityManager } from "../../src/modules/orchestration/broker/capacity-manager";
import { ProviderRouter } from "../../src/modules/orchestration/broker/router";

const base = {
  dataClassification: "internal" as const,
  requiredTools: ["repository-read", "structured-output", "simulation"],
  purpose: "primary" as const,
};

describe("provider routing", () => {
  it("uses configurable Claude-first preference for documentation", () => {
    const decision = new ProviderRouter(new CapacityManager()).route({
      ...base,
      workflowType: "documentation",
      preferredProvider: "auto",
    });
    expect(decision.provider).toBe("claude");
  });

  it("selects Codex for implementation affinity", () => {
    const decision = new ProviderRouter(new CapacityManager()).route({
      ...base,
      workflowType: "implementation",
      preferredProvider: "auto",
    });
    expect(decision.provider).toBe("codex");
  });

  it("honors an explicit provider override when policy permits", () => {
    const decision = new ProviderRouter(new CapacityManager()).route({
      ...base,
      workflowType: "documentation",
      preferredProvider: "codex",
    });
    expect(decision.provider).toBe("codex");
  });

  it("lets policy eligibility override preference", () => {
    const decision = new ProviderRouter(new CapacityManager()).route({
      ...base,
      workflowType: "documentation",
      dataClassification: "restricted",
      preferredProvider: "claude",
    });
    expect(decision.provider).toBeNull();
    expect(decision.scores.every((score) => !score.eligible)).toBe(true);
  });

  it("selects a provider other than the author for independent review", () => {
    const decision = new ProviderRouter(new CapacityManager()).independentReviewer(
      "codex",
      "codex-author-session",
      {
        workflowType: "review",
        dataClassification: "internal",
        preferredProvider: "auto",
        requiredTools: ["repository-read", "structured-output", "simulation"],
      },
    );
    expect(decision.provider).toBe("claude");
    expect(decision.scores.find(({ provider }) => provider === "codex")?.eligible).toBe(false);
  });
});
