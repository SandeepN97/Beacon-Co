import { createHash } from "node:crypto";
import { z } from "astro/zod";
import { AgentRiskClassSchema, AgentRoleSchema } from "../domain/agent-run.ts";
import { EvalResultSchema, type EvalResult } from "../domain/eval-result.ts";

export const EvalScenarioSchema = z
  .object({
    id: z.string().min(1).max(160),
    family: z.string().min(1).max(160),
    riskClass: AgentRiskClassSchema,
    ownerRole: AgentRoleSchema,
    assertions: z.array(z.string().min(1).max(160)).min(1),
  })
  .strict();

export const EvalScenarioCatalogSchema = z
  .object({
    schemaVersion: z.literal(1),
    scenarios: z.array(EvalScenarioSchema).min(1),
  })
  .strict();

export type EvalScenario = z.infer<typeof EvalScenarioSchema>;
export type AssertionOutcome = { passed: boolean; evidence: string };
export type ScenarioEvaluator = (scenario: EvalScenario) => Record<string, AssertionOutcome>;

export const REQUIRED_SCENARIO_FAMILIES = [
  "docs-only-change",
  "small-typescript-bug-fix",
  "multi-file-refactor",
  "ui-accessibility-change",
  "failing-test-repair",
  "ambiguous-request-routing",
  "agent-contract-change",
  "github-actions-change",
  "dependency-change",
  "authorization-security-change",
  "secret-env-access-attempt",
  "destructive-shell-attempt",
  "context-duplication-overflow",
  "provider-capacity-handoff",
  "reviewer-disagreement",
  "production-release-request",
] as const;

export function validateScenarioCatalog(input: unknown): EvalScenario[] {
  const catalog = EvalScenarioCatalogSchema.parse(input);
  const ids = new Set<string>();
  for (const scenario of catalog.scenarios) {
    if (ids.has(scenario.id)) throw new Error(`duplicate eval scenario id: ${scenario.id}`);
    ids.add(scenario.id);
  }
  const families = new Set(catalog.scenarios.map((scenario) => scenario.family));
  const missing = REQUIRED_SCENARIO_FAMILIES.filter((family) => !families.has(family));
  if (missing.length > 0) throw new Error(`missing eval scenario families: ${missing.join(", ")}`);
  return [...catalog.scenarios].sort((left, right) => left.id.localeCompare(right.id));
}

export function runDeterministicEval(
  scenario: EvalScenario,
  evaluator: ScenarioEvaluator,
): EvalResult {
  const outcomes = evaluator(scenario);
  const assertions = scenario.assertions.map((name) => ({
    name,
    passed: outcomes[name]?.passed ?? false,
    evidence: outcomes[name]?.evidence ?? "missing evaluator evidence",
  }));
  const passed = assertions.every((assertion) => assertion.passed);
  const evaluationId = createHash("sha256")
    .update(JSON.stringify({ scenario, assertions }))
    .digest("hex")
    .slice(0, 32);
  return EvalResultSchema.parse({
    schemaVersion: 1,
    evaluationId: `eval-${evaluationId}`,
    scenarioId: scenario.id,
    lane: "deterministic",
    attempt: 1,
    status: passed ? "passed" : "failed",
    assertions,
    metrics: {
      taskSuccess: passed,
      unauthorizedActionCount: passed ? 0 : null,
      scopeViolationCount: passed ? 0 : null,
      tokens: null,
      cachedTokens: null,
      turns: null,
      toolCalls: null,
      retries: null,
      latencyMs: null,
      costUsd: null,
      evidenceCompleteness:
        assertions.filter((assertion) => assertion.evidence).length / assertions.length,
    },
    evidenceIds: [`fixture:${scenario.id}`],
  });
}
