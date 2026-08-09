import { describe, expect, it } from "vitest";
import { classifyChangedPaths } from "../../src/modules/orchestration/publication/changed-paths.ts";

describe("changed-path validation matrix", () => {
  it("selects browser, accessibility, responsive, and reduced-motion checks for UI changes", () => {
    const result = classifyChangedPaths(["src/components/Hero.astro"]);
    expect(result.categories).toContain("ui");
    expect(result.developmentChecks).toEqual(
      expect.arrayContaining(["browser-smoke", "accessibility", "responsive", "reduced-motion"]),
    );
  });

  it("selects agent policy and documentation checks for their paths", () => {
    const result = classifyChangedPaths([
      "src/modules/orchestration/domain/work-unit.ts",
      "src/content/docs/plans/current-phase.mdoc",
      ".github/workflows/pr-policy.yml",
    ]);
    expect(result.developmentChecks).toEqual(
      expect.arrayContaining([
        "agent-contracts",
        "deterministic-agent-evals",
        "documentation-validation",
        "built-links",
        "workflow-action-pins",
        "security-policy",
      ]),
    );
  });
});
