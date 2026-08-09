import { describe, expect, it } from "vitest";
import { compilePromptContext } from "../../src/modules/orchestration/context/compiler.ts";
import { runContextPreflight } from "../../src/modules/orchestration/context/preflight.ts";

const CONTRACT_SHA = "a".repeat(64);

function input() {
  return {
    workUnitId: "wu-context-1",
    objective: "Fix `src/a.ts` after ERROR_CODE_42 without changing API_SHA_abc123.",
    agentRole: "code-writer" as const,
    riskClass: "risk-1" as const,
    contractSha256: CONTRACT_SHA,
    maxContextTokens: 24_000,
    allowedPaths: ["src/a.ts", "tests/a.test.ts", "src/a.ts"],
    allowedTools: ["Read", "Edit", "Read"],
    acceptanceCriteria: ["Preserve ERROR_CODE_42 exactly", "Tests pass"],
    searchTerms: ["ERROR_CODE_42", "API_SHA_abc123"],
    candidates: [
      {
        path: "src/a.ts",
        content: "throw new Error('ERROR_CODE_42'); // API_SHA_abc123",
        classification: "internal" as const,
        exactData: true,
        mustEmbed: true,
      },
    ],
  };
}

describe("deterministic context preflight and compilation", () => {
  it("produces byte-stable packages and compilations", () => {
    const first = runContextPreflight(input());
    const second = runContextPreflight(input());
    expect(second).toEqual(first);
    expect(compilePromptContext({ contextPackage: second, objective: input().objective })).toEqual(
      compilePromptContext({ contextPackage: first, objective: input().objective }),
    );
  });

  it("deduplicates context and defaults to references", () => {
    const base = input();
    const candidate = { ...base.candidates[0], mustEmbed: false };
    const result = runContextPreflight({
      ...base,
      candidates: [candidate, candidate, candidate, candidate],
    });
    expect(result.inventory).toHaveLength(1);
    expect(result.inventory[0].delivery).toBe("reference");
    expect(result.inventory[0].content).toBeNull();
    expect(result.duplicatesRemoved).toBe(3);
    expect(result.tokenAuditor).toEqual({
      required: true,
      reasons: ["significant-duplication"],
    });
  });

  it("preserves exact technical material when embedding is required", () => {
    const result = runContextPreflight(input());
    const compilation = compilePromptContext({
      contextPackage: result,
      objective: input().objective,
    });
    expect(compilation.variableContext).toContain("ERROR_CODE_42");
    expect(compilation.variableContext).toContain("API_SHA_abc123");
    expect(compilation.variableContext).toContain("src/a.ts");
  });

  it("keeps the cacheable prefix stable across variable tasks", () => {
    const first = runContextPreflight(input());
    const secondInput = { ...input(), objective: "A different bounded task" };
    const second = runContextPreflight(secondInput);
    const firstCompilation = compilePromptContext({
      contextPackage: first,
      objective: input().objective,
    });
    const secondCompilation = compilePromptContext({
      contextPackage: second,
      objective: secondInput.objective,
    });
    expect(secondCompilation.stablePrefix).toBe(firstCompilation.stablePrefix);
    expect(secondCompilation.stablePrefixHash).toBe(firstCompilation.stablePrefixHash);
    expect(secondCompilation.variableContextHash).not.toBe(firstCompilation.variableContextHash);
  });

  it("invokes token-auditor only for deterministic abnormal triggers", () => {
    expect(runContextPreflight(input()).tokenAuditor).toEqual({ required: false, reasons: [] });
    const triggered = runContextPreflight({
      ...input(),
      maxContextTokens: 1,
      routingAmbiguous: true,
      capacityOrFallback: true,
      previousContextBytes: 1,
    });
    expect(triggered.tokenAuditor.required).toBe(true);
    expect(triggered.tokenAuditor.reasons).toEqual([
      "budget-breach",
      "routing-ambiguity",
      "unusual-context-growth",
      "capacity-or-fallback",
    ]);
  });

  it("rejects unsafe paths and empty search evidence", () => {
    expect(() => runContextPreflight({ ...input(), allowedPaths: ["../outside"] })).toThrow();
    expect(() => runContextPreflight({ ...input(), searchTerms: [] })).toThrow();
  });
});
