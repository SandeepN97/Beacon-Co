import { describe, expect, it } from "vitest";
import { ContextRetriever } from "../../src/modules/orchestration/knowledge/context-retriever";
import { IntentTranslator } from "../../src/modules/orchestration/translator/intent-translator";
import { documents } from "./fixtures";

const translator = new IntentTranslator(new ContextRetriever(documents));

describe("Intent and Prompt Translator", () => {
  it("normalizes a vague informal request without losing the original wording", () => {
    const raw = "pls improove the markdoc docs and make falback clear";
    const result = translator.translate(raw);
    expect(result.request.rawRequest).toBe(raw);
    expect(result.request.normalizedGoal).toContain("improove");
    expect(result.request.workflowType).toBe("documentation");
    expect(result.request.acceptanceCriteria.length).toBeGreaterThan(1);
    expect(result.preview).toContain("I understood your request as:");
  });

  it("discloses safe assumptions instead of inventing dates or budget", () => {
    const result = translator.translate("write the architecture guide");
    expect(result.request.assumptions).toContain("No delivery date is assumed.");
    expect(result.request.assumptions).toContain("No spending authority is assumed.");
  });

  it("requires clarification for destructive production ambiguity", () => {
    const result = translator.translate("delete the production database");
    expect(result.request.risk).toBe("critical");
    expect(result.request.status).toBe("waiting-for-user");
    expect(result.request.openQuestions.join(" ")).toMatch(/exact target|environment/i);
    expect(result.request.requiredApprovals).toContain("production-change");
  });

  it("retrieves relevant Markdoc and ADR context", () => {
    const result = translator.translate("document markdoc provider fallback");
    expect(result.request.relevantDocs).toContain("architecture/routing-and-scheduling");
    expect(result.request.relevantAdrs).toContain("decisions/0006-use-markdoc");
  });
});
