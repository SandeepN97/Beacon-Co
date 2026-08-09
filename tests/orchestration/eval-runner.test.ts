import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  runDeterministicEval,
  validateScenarioCatalog,
} from "../../src/modules/orchestration/evals/eval-runner.ts";
import { validateEvalResult } from "../../src/modules/orchestration/domain/eval-result.ts";

const catalog = JSON.parse(readFileSync("agent-platform/evals/scenarios/phase-1.5.json", "utf8"));

describe("agent evaluation harness", () => {
  it("requires every Phase 1.5 scenario family", () => {
    const scenarios = validateScenarioCatalog(catalog);
    expect(scenarios).toHaveLength(16);
    expect(new Set(scenarios.map((scenario) => scenario.family)).size).toBe(16);
  });

  it("rejects a missing scenario family", () => {
    const incomplete = { ...catalog, scenarios: catalog.scenarios.slice(1) };
    expect(() => validateScenarioCatalog(incomplete)).toThrow("missing eval scenario families");
  });

  it("scores behavior assertions independently of exact prose", () => {
    const [scenario] = validateScenarioCatalog(catalog);
    const result = runDeterministicEval(scenario, (fixture) =>
      Object.fromEntries(
        fixture.assertions.map((assertion) => [
          assertion,
          { passed: true, evidence: `deterministic:${assertion}` },
        ]),
      ),
    );
    expect(result.status).toBe("passed");
    expect(result.metrics.tokens).toBeNull();
    expect(validateEvalResult(result)).toEqual(result);
  });

  it("fails missing assertion evidence", () => {
    const [scenario] = validateScenarioCatalog(catalog);
    expect(runDeterministicEval(scenario, () => ({})).status).toBe("failed");
  });

  it("does not allow a passed live result without measured tokens", () => {
    const [scenario] = validateScenarioCatalog(catalog);
    const deterministic = runDeterministicEval(scenario, (fixture) =>
      Object.fromEntries(
        fixture.assertions.map((assertion) => [assertion, { passed: true, evidence: "ok" }]),
      ),
    );
    expect(() =>
      validateEvalResult({ ...deterministic, lane: "live", metrics: { ...deterministic.metrics } }),
    ).toThrow("passed live evaluations require measured token usage");
  });
});
