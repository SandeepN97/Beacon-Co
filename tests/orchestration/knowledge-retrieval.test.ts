import { describe, expect, it } from "vitest";
import { ContextRetriever } from "../../src/modules/orchestration/knowledge/context-retriever";
import { detectConflicts } from "../../src/modules/orchestration/knowledge/conflict-detector";
import { documents } from "./fixtures";

describe("Markdoc knowledge retrieval", () => {
  it("ranks approved relevant documentation", () => {
    const results = new ContextRetriever(documents).retrieve("Claude Codex fallback");
    expect(results[0].document.id).toBe("architecture/routing-and-scheduling");
    expect(results[0].score).toBeGreaterThan(0);
  });

  it("detects conflicting claims without silently choosing one", () => {
    const conflicts = detectConflicts([
      { ...documents[0], id: "plans/a", claims: [{ key: "docs-system", value: "Markdoc" }] },
      { ...documents[1], id: "plans/b", claims: [{ key: "docs-system", value: "MkDocs" }] },
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].sources).toEqual(["plans/a", "plans/b"]);
    expect(conflicts[0].values).toContain("Markdoc");
    expect(conflicts[0].values).toContain("MkDocs");
  });
});
