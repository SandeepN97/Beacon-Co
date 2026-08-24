import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  TaskClassificationEventLog,
  classifyTask,
  compareTaskClassToAgentRun,
  deriveWorkUnitTaskSignals,
} from "../../src/modules/orchestration/decision-os/task-classifier.ts";
import { CapacityManager } from "../../src/modules/orchestration/broker/capacity-manager.ts";
import { ProviderRouter } from "../../src/modules/orchestration/broker/router.ts";
import { validateAgentRun } from "../../src/modules/orchestration/domain/agent-run.ts";
import { ProviderIdSchema } from "../../src/modules/orchestration/domain/provider-run.ts";
import {
  TaskClassSchema,
  type WorkUnit,
  type WorkUnitRole,
} from "../../src/modules/orchestration/domain/work-unit.ts";
import type { WorkRequest } from "../../src/modules/orchestration/domain/work-request.ts";
import { runOrchestrationSimulation } from "../../src/modules/orchestration/simulation.ts";
import { documents } from "./fixtures.ts";

function request(overrides: Partial<WorkRequest> = {}): WorkRequest {
  return {
    id: "request-1",
    rawRequest: "fix the search bug",
    normalizedGoal: "fix the search bug",
    businessOutcome: "search works",
    workflowType: "implementation",
    requestedDeliverables: [],
    acceptanceCriteria: ["search works"],
    constraints: [],
    nonGoals: [],
    assumptions: [],
    openQuestions: [],
    dependencies: [],
    risk: "low",
    dataClassification: "internal",
    requiredApprovals: [],
    relevantDocs: [],
    relevantAdrs: [],
    recommendedFirstRole: "code-writer",
    preferredProvider: "auto",
    providerReason: "no preference",
    documentationImpactExpected: false,
    status: "ready-for-routing",
    ...overrides,
  };
}

function workUnit(role: WorkUnitRole = "code-writer", overrides: Partial<WorkUnit> = {}): WorkUnit {
  const workRequest = overrides.request ?? request();
  return {
    id: "work-unit-1",
    request: workRequest,
    goal: workRequest.normalizedGoal,
    acceptanceCriteria: workRequest.acceptanceCriteria,
    constraints: workRequest.constraints,
    risk: workRequest.risk,
    dependencies: workRequest.dependencies,
    status: "ready",
    assignedProvider: null,
    authorSessionId: null,
    retryCount: 0,
    ...deriveWorkUnitTaskSignals(role, workRequest.risk, 1200),
    ...overrides,
  };
}

const emptyUsage = {
  totalInputTokens: null,
  cachedInputTokens: null,
  cacheWriteTokens: null,
  uncachedInputTokens: null,
  outputTokens: null,
  reasoningTokens: null,
  totalTokens: null,
};

describe("Section 29B.2 Task Classifier", () => {
  it("uses the canonical eight-value taskClass enum", () => {
    expect(TaskClassSchema.options).toEqual([
      "architecture",
      "research",
      "codebase_discovery",
      "implementation",
      "qa",
      "pr_review",
      "release",
      "learning_explanation",
    ]);
  });

  it.each<[WorkUnitRole, string]>([
    ["chief-of-staff", "architecture"],
    ["market-researcher", "research"],
    ["codebase-researcher", "codebase_discovery"],
    ["code-writer", "implementation"],
    ["qa-engineer", "qa"],
    ["pr-reviewer", "pr_review"],
    ["release-manager", "release"],
  ])("maps %s to %s without consulting provider state", (role, taskClass) => {
    expect(classifyTask(workUnit(role))).toBe(taskClass);
  });

  it("reads and rejects inconsistent risk/review and permission/write signals", () => {
    expect(() =>
      classifyTask(workUnit("code-writer", { independentReviewRequired: true })),
    ).toThrow("independent review");
    expect(() => classifyTask(workUnit("code-writer", { writeRequired: false }))).toThrow(
      "writeRequired",
    );
  });
});

describe("TaskClassified observation", () => {
  it("records exactly one private TaskClassified event for each WorkUnit", () => {
    const log = new TaskClassificationEventLog();
    const first = workUnit("code-writer");
    const second = workUnit("qa-engineer", { id: "work-unit-2" });
    log.record(first, {
      eventId: "task-classified-1",
      projectRef: "beacon-co",
      occurredAt: "2026-08-24T12:00:00.000Z",
    });
    log.record(first, {
      eventId: "ignored-duplicate-classification",
      projectRef: "beacon-co",
      occurredAt: "2026-08-24T12:00:02.000Z",
    });
    log.record(second, {
      eventId: "task-classified-2",
      projectRef: "beacon-co",
      occurredAt: "2026-08-24T12:00:01.000Z",
    });
    expect(log.all()).toMatchObject([
      {
        eventType: "TaskClassified",
        visibility: "private",
        correlationRef: "work-unit-1",
        payload: { workUnitId: "work-unit-1", taskClass: "implementation" },
      },
      {
        eventType: "TaskClassified",
        visibility: "private",
        correlationRef: "work-unit-2",
        payload: { workUnitId: "work-unit-2", taskClass: "qa" },
      },
    ]);
  });

  it("is comparable to the actual provider while leaving routing unchanged", () => {
    const result = runOrchestrationSimulation("fix a small search bug", documents);
    const event = result.taskClassifications[0];
    const routingInput = {
      workflowType: result.translation.request.workflowType,
      dataClassification: result.translation.request.dataClassification,
      preferredProvider: result.translation.request.preferredProvider,
      requiredTools: ["repository-read", "structured-output", "simulation"],
      purpose: "primary" as const,
    };
    const controlDecision = new ProviderRouter(new CapacityManager()).route(routingInput);
    expect(result.execution.routing).toEqual(controlDecision);
    expect(result.execution.workUnit.assignedProvider).toBe("codex");
    expect(event.payload.taskClass).toBe("codebase_discovery");

    const agentRun = validateAgentRun({
      schemaVersion: 1,
      id: "agent-run-1",
      workUnitId: event.payload.workUnitId,
      taskFingerprint: "a".repeat(64),
      agentRole: "codebase-researcher",
      contractVersion: "1",
      contractSha256: "b".repeat(64),
      riskClass: "risk-0",
      provider: result.execution.workUnit.assignedProvider,
      resolvedModelId: "codex-test",
      requestedEffort: null,
      startedAt: "2026-08-24T12:00:00.000Z",
      completedAt: "2026-08-24T12:00:01.000Z",
      durationMs: 1000,
      status: "succeeded",
      stopReason: "completed",
      providerRunIds: ["provider-run-1"],
      context: {
        contextBytes: 0,
        estimatedInputTokens: 0,
        usage: emptyUsage,
        referencedFiles: [],
        readFileCount: 0,
        changedFileCount: 0,
        compilationHash: null,
      },
      execution: {
        turns: 1,
        toolCallCount: 0,
        retryCount: 0,
        fallbackUsed: false,
        handoffUsed: false,
        policyDecisions: { allow: 0, ask: 0, deny: 0 },
      },
      outcome: {
        authorValidationPassed: null,
        qaPassed: null,
        reviewDisposition: "not-reviewed",
        blockingFindingCount: 0,
        majorFindingCount: 0,
        finalState: "complete",
      },
      evidenceIds: [],
    });
    expect(compareTaskClassToAgentRun(event, agentRun)).toEqual({
      workUnitId: event.payload.workUnitId,
      taskClass: "codebase_discovery",
      actualProvider: "codex",
    });
  });
});

describe("PR-0.6 routing isolation", () => {
  it("keeps Claude and Codex as the complete routable and role-eligible provider set", async () => {
    const contracts = parse(
      await readFile(new URL("../../agent-platform/agent-contracts.yml", import.meta.url), "utf8"),
    ) as {
      providers: string[];
      roles: Array<{ provider: { eligible: string[] } }>;
    };

    expect(ProviderIdSchema.options).toEqual(["claude", "codex"]);
    expect(new CapacityManager().list().map(({ provider }) => provider)).toEqual([
      "claude",
      "codex",
    ]);
    expect(contracts.providers).toEqual(["claude", "codex"]);
    expect(
      contracts.roles.every(({ provider }) => provider.eligible.join(",") === "claude,codex"),
    ).toBe(true);
  });

  it("keeps HarnessAdapter unregistered and classifier output outside execution control", async () => {
    const controlSources = await Promise.all(
      [
        "broker/broker.ts",
        "broker/router.ts",
        "broker/capacity-manager.ts",
        "broker/routing-policy.ts",
      ].map((path) =>
        readFile(new URL(`../../src/modules/orchestration/${path}`, import.meta.url), "utf8"),
      ),
    );
    for (const source of controlSources) {
      expect(source).not.toMatch(
        /HarnessAdapter|OpenCodeProcessTransport|TaskClassified|taskClass|groq/,
      );
    }

    const simulationSource = await readFile(
      new URL("../../src/modules/orchestration/simulation.ts", import.meta.url),
      "utf8",
    );
    expect(simulationSource).not.toMatch(/HarnessAdapter|OpenCodeProcessTransport/);

    const result = runOrchestrationSimulation("fix a small search bug", documents);
    expect(result.simulated).toBe(true);
    expect(result.execution.routing?.provider).toBe("codex");
    expect(result.execution.providerResult).toMatchObject({
      provider: "codex",
      liveInvocation: false,
    });
    expect(result.taskClassifications).toHaveLength(1);
    expect(result.taskClassifications[0].eventType).toBe("TaskClassified");
  });
});
