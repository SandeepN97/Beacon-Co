import { describe, expect, it } from "vitest";
import { analyzeDocumentationImpact } from "../../src/modules/orchestration/documentation/impact-analyzer";
import { ContextRetriever } from "../../src/modules/orchestration/knowledge/context-retriever";
import { IntentTranslator } from "../../src/modules/orchestration/translator/intent-translator";
import { documents } from "./fixtures";

describe("documentation impact", () => {
  it("requires an ADR proposal for architecture change", () => {
    const request = new IntentTranslator(new ContextRetriever(documents)).translate(
      "change the provider architecture after approval",
    ).request;
    const impact = analyzeDocumentationImpact(request, {
      filesChanged: ["src/modules/orchestration/broker/router.ts"],
      behaviorChanged: true,
      architectureChanged: true,
      businessRuleChanged: false,
      uiChanged: false,
    });
    expect(impact.level).toBe("adr");
    expect(impact.adrRequired).toBe(true);
    expect(impact.pagesToUpdate).toContain("architecture/overview");
    expect(impact.proposalOnly).toBe(true);
  });

  it("returns no impact when a review makes no material change", () => {
    const request = new IntentTranslator(new ContextRetriever(documents)).translate(
      "review the current tests",
    ).request;
    const impact = analyzeDocumentationImpact(request, {
      filesChanged: [],
      behaviorChanged: false,
      architectureChanged: false,
      businessRuleChanged: false,
      uiChanged: false,
    });
    expect(impact.level).toBe("none");
  });
});
