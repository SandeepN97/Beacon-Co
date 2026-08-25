import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runContextPreflight } from "../../src/modules/orchestration/context/preflight.ts";
import {
  AppendOnlyNdjsonExecutionBudgetEvidenceStore,
  authorizeExecutionBudgetLineage,
  ExecutionBudgetLedger,
  InMemoryExecutionBudgetEvidenceStore,
} from "../../src/modules/orchestration/execution-budget/execution-budget.ts";
import { ClaudeAdapter } from "../../src/modules/orchestration/providers/claude/claude-adapter.ts";
import { CodexAdapter } from "../../src/modules/orchestration/providers/codex/codex-adapter.ts";
import { CodexCliTransport } from "../../src/modules/orchestration/providers/codex/codex-cli-transport.ts";
import { HttpProviderTransport } from "../../src/modules/orchestration/providers/http-provider-transport.ts";
import {
  extractClaudeResult,
  extractCodexResult,
} from "../../src/modules/orchestration/providers/live-adapter-support.ts";
import {
  ProviderExecutionError,
  type ProviderExecutionRequest,
  type ProviderTransport,
  type ProviderTransportBudgetContract,
} from "../../src/modules/orchestration/providers/provider-adapter.ts";
import { createLocalTelemetrySink } from "../../src/modules/orchestration/telemetry/sink.ts";
import { executeLiveWorkUnit } from "../../src/modules/orchestration/workflows/live-work-unit.ts";

class FixtureTransport implements ProviderTransport {
  readonly invocations: Array<{ provider: "claude" | "codex"; payload: Record<string, unknown> }> =
    [];
  constructor(
    private readonly response: Record<string, unknown>,
    private readonly contract: ProviderTransportBudgetContract | null = null,
  ) {}
  executionBudgetContract(provider: "claude" | "codex") {
    if (this.contract) return this.contract;
    return {
      kind: "single-generation" as const,
      generationBranchesPerInvoke: 1 as const,
      automaticRetries: false as const,
      hardOutputTokenCap:
        provider === "claude"
          ? ("anthropic-max-tokens" as const)
          : ("openai-max-output-tokens" as const),
      authoritativeTerminalUsage: true as const,
      streaming: false as const,
    };
  }
  async invoke(provider: "claude" | "codex", payload: Record<string, unknown>) {
    this.invocations.push({ provider, payload });
    return this.response;
  }
}

class ThrowingTransport extends FixtureTransport {
  override async invoke(
    provider: "claude" | "codex",
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    this.invocations.push({ provider, payload });
    throw new ProviderExecutionError(provider, "transient", "synthetic failure", true);
  }
}

const baseRequest = {
  providerRunId: "provider-run-1",
  agentRunId: "agent-run-1",
  workUnitId: "work-unit-1",
  taskFingerprint: "b".repeat(64),
  prompt: "Return the word ready.",
  compilationHash: "c".repeat(64),
  resolvedModelId: "requested-model",
  requestedEffort: "medium",
  maxOutputTokens: 100,
  maxModelCalls: 2,
  maxTurns: 2,
};

async function executionRequest(
  overrides: Partial<ProviderExecutionRequest> = {},
): Promise<ProviderExecutionRequest> {
  const workUnitId = overrides.workUnitId ?? baseRequest.workUnitId;
  const maxModelCalls = overrides.maxModelCalls ?? baseRequest.maxModelCalls;
  const maxOutputTokens = overrides.maxOutputTokens ?? baseRequest.maxOutputTokens;
  const journalRoot = await mkdtemp(join(tmpdir(), "beacon-provider-budget-"));
  const ledger = await ExecutionBudgetLedger.create(
    authorizeExecutionBudgetLineage({
      budgetLineageId: `lineage-${crypto.randomUUID()}`,
      workUnitId,
      maxModelCalls,
      maxOutputTokens,
      authorizedAt: "2026-08-09T12:00:00.000Z",
      authorizedBy: "provider-adapter-test",
      authorizationEvidenceId: "test-authority",
    }),
    new AppendOnlyNdjsonExecutionBudgetEvidenceStore(
      join(journalRoot, "execution-budget-ledgers.ndjson"),
    ),
  );
  return {
    ...baseRequest,
    budgetLineageId: ledger.budgetLineageId,
    budgetLedger: ledger,
    modelCallKind: "initial",
    ...overrides,
  };
}

function clock() {
  const dates = [new Date("2026-08-09T12:00:00.000Z"), new Date("2026-08-09T12:00:00.250Z")];
  let index = 0;
  return () => dates[Math.min(index++, dates.length - 1)];
}

describe("provider-neutral live adapters", () => {
  it("normalizes a Claude response", async () => {
    const adapter = new ClaudeAdapter(
      new FixtureTransport({
        id: "msg_1",
        type: "message",
        model: "claude-test",
        stop_reason: "end_turn",
        usage: {
          input_tokens: 10,
          cache_read_input_tokens: 5,
          cache_creation_input_tokens: 2,
          output_tokens: 3,
        },
        content: [{ type: "text", text: "ready" }],
      }),
      clock(),
    );
    const result = await adapter.execute(await executionRequest());
    expect(result.outputText).toBe("ready");
    expect(result.providerRun).toMatchObject({
      provider: "claude",
      resolvedModelId: "claude-test",
      durationMs: 250,
      usage: {
        totalInputTokens: 17,
        cachedInputTokens: 5,
        cacheWriteTokens: 2,
        uncachedInputTokens: 10,
        outputTokens: 3,
        totalTokens: 20,
      },
    });
  });

  it("normalizes a Codex/OpenAI response and tool evidence", async () => {
    const adapter = new CodexAdapter(
      new FixtureTransport({
        id: "resp_1",
        status: "completed",
        model: "codex-test",
        usage: {
          input_tokens: 20,
          input_tokens_details: { cached_tokens: 8 },
          output_tokens: 6,
          output_tokens_details: { reasoning_tokens: 2 },
          total_tokens: 26,
        },
        output: [
          { type: "message", content: [{ type: "output_text", text: "ready" }] },
          {
            type: "function_call",
            call_id: "call_1",
            name: "read_file",
            arguments: '{"path":"src/a.ts"}',
          },
        ],
      }),
      clock(),
    );
    const result = await adapter.execute(await executionRequest());
    expect(result.providerRun.usage).toMatchObject({
      totalInputTokens: 20,
      cachedInputTokens: 8,
      uncachedInputTokens: 12,
      reasoningTokens: 2,
    });
    expect(result.toolEvidence).toMatchObject([{ toolCallId: "call_1", toolName: "read_file" }]);
  });

  it("makes Claude direct HTTP budget-compliant before invocation", async () => {
    let invocationCount = 0;
    let payload: Record<string, unknown> = {};
    const response = {
      id: "msg_budget",
      type: "message",
      model: "claude-test",
      stop_reason: "end_turn",
      usage: { input_tokens: 4, output_tokens: 7 },
      content: [{ type: "text", text: "ready" }],
    };
    const fetchImplementation = (async (_input: unknown, init?: RequestInit) => {
      invocationCount += 1;
      payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    const transport = new HttpProviderTransport(
      { anthropicApiKey: "synthetic-anthropic-key" },
      fetchImplementation,
    );
    const providerRequest = await executionRequest();
    const result = await new ClaudeAdapter(transport, clock()).execute(providerRequest);
    expect(invocationCount).toBe(1);
    expect(payload.max_tokens).toBe(100);
    expect(providerRequest.budgetLedger.snapshot()).toMatchObject({
      modelCallsInitiated: 1,
      observedOutputTokens: 7,
      policyChargedOutputTokens: 7,
      outputTokensRemaining: 93,
    });
    expect(result.providerRun).toMatchObject({
      turns: 1,
      retryCount: 0,
      providerMetadata: {
        executionBudget: {
          budgetLineageId: providerRequest.budgetLineageId,
          reservationState: "SETTLED_AUTHORITATIVE",
          observedOutputTokens: 7,
          policyChargedOutputTokens: 7,
        },
      },
    });
  });

  it("makes Codex direct HTTP reasoning-inclusive output budget-compliant", async () => {
    let invocationCount = 0;
    let payload: Record<string, unknown> = {};
    const response = {
      id: "resp_budget",
      status: "completed",
      model: "codex-test",
      usage: {
        input_tokens: 10,
        input_tokens_details: { cached_tokens: 0 },
        output_tokens: 40,
        output_tokens_details: { reasoning_tokens: 30 },
        total_tokens: 50,
      },
      output: [{ type: "message", content: [{ type: "output_text", text: "ready" }] }],
    };
    const fetchImplementation = (async (_input: unknown, init?: RequestInit) => {
      invocationCount += 1;
      payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    const transport = new HttpProviderTransport(
      { openaiApiKey: "synthetic-openai-key" },
      fetchImplementation,
    );
    const providerRequest = await executionRequest();
    const result = await new CodexAdapter(transport, clock()).execute(providerRequest);
    expect(invocationCount).toBe(1);
    expect(payload).toMatchObject({
      max_output_tokens: 100,
      reasoning: { effort: "medium" },
    });
    expect(result.providerRun.usage).toMatchObject({
      outputTokens: 40,
      reasoningTokens: 30,
    });
    expect(providerRequest.budgetLedger.snapshot()).toMatchObject({
      observedOutputTokens: 40,
      policyChargedOutputTokens: 40,
      outputTokensRemaining: 60,
    });
  });

  it("charges missing terminal usage conservatively without fabricating observation", async () => {
    const providerRequest = await executionRequest();
    const adapter = new CodexAdapter(
      new FixtureTransport({
        id: "resp_missing_usage",
        status: "completed",
        model: "codex-test",
        usage: { input_tokens: 4 },
        output: [{ type: "message", content: [{ type: "output_text", text: "ready" }] }],
      }),
      clock(),
    );
    await expect(adapter.execute(providerRequest)).rejects.toMatchObject({
      category: "invalid-response",
      retryable: false,
    });
    expect(providerRequest.budgetLedger.snapshot()).toMatchObject({
      modelCallsInitiated: 1,
      observedOutputTokens: null,
      policyChargedOutputTokens: 100,
    });
  });

  it("charges malformed terminal usage conservatively", async () => {
    const providerRequest = await executionRequest();
    const adapter = new ClaudeAdapter(
      new FixtureTransport({
        id: "msg_invalid_usage",
        type: "message",
        model: "claude-test",
        stop_reason: "end_turn",
        usage: { input_tokens: 4, output_tokens: -1 },
        content: [{ type: "text", text: "ready" }],
      }),
      clock(),
    );
    await expect(adapter.execute(providerRequest)).rejects.toMatchObject({
      category: "invalid-response",
    });
    expect(providerRequest.budgetLedger.snapshot()).toMatchObject({
      observedOutputTokens: null,
      policyChargedOutputTokens: 100,
    });
  });

  it("charges unsupported provider usage units conservatively", async () => {
    const providerRequest = await executionRequest();
    const adapter = new CodexAdapter(
      new FixtureTransport({
        id: "resp_unsupported_unit",
        status: "completed",
        model: "codex-test",
        usage: { input_tokens: 4, output_tokens: 2, total_tokens: 6, unit: "characters" },
        output: [{ type: "message", content: [{ type: "output_text", text: "ok" }] }],
      }),
      clock(),
    );
    await expect(adapter.execute(providerRequest)).rejects.toMatchObject({
      category: "invalid-response",
    });
    expect(providerRequest.budgetLedger.snapshot()).toMatchObject({
      observedOutputTokens: null,
      policyChargedOutputTokens: 100,
    });
  });

  it("rejects missing credentials before admission without consuming capacity", async () => {
    const providerRequest = await executionRequest();
    await expect(
      new ClaudeAdapter(new HttpProviderTransport({})).execute(providerRequest),
    ).rejects.toMatchObject({ category: "authentication", retryable: false });
    expect(providerRequest.budgetLedger.snapshot()).toMatchObject({
      modelCallsReserved: 0,
      modelCallsInitiated: 0,
      outputTokensReserved: 0,
      policyChargedOutputTokens: 0,
    });
  });

  it("binds the live request to the lineage WorkUnit before invocation", async () => {
    const transport = new FixtureTransport({});
    const providerRequest = await executionRequest();
    await expect(
      new CodexAdapter(transport).execute({
        ...providerRequest,
        workUnitId: "different-work-unit",
      }),
    ).rejects.toMatchObject({ category: "policy", retryable: false });
    expect(transport.invocations).toHaveLength(0);
    expect(providerRequest.budgetLedger.snapshot().reservations).toHaveLength(0);
  });

  it("preserves distinct model-call and output-token denial reasons", async () => {
    const modelCallTransport = new FixtureTransport({
      id: "resp_model_call_limit",
      status: "completed",
      model: "codex-test",
      usage: { input_tokens: 1, output_tokens: 10, total_tokens: 11 },
      output: [],
    });
    const modelCallRequest = await executionRequest({ maxModelCalls: 1, maxTurns: 1 });
    const modelCallAdapter = new CodexAdapter(modelCallTransport, clock());
    await modelCallAdapter.execute(modelCallRequest);
    await expect(
      modelCallAdapter.execute({
        ...modelCallRequest,
        providerRunId: "provider-run-model-n-plus-1",
      }),
    ).rejects.toMatchObject({
      category: "policy",
      retryable: false,
      stopReason: "model-call-budget-exhausted",
    });
    expect(modelCallTransport.invocations).toHaveLength(1);

    const outputTransport = new FixtureTransport({
      id: "resp_output_limit",
      status: "completed",
      model: "codex-test",
      usage: { input_tokens: 1, output_tokens: 100, total_tokens: 101 },
      output: [],
    });
    const outputRequest = await executionRequest();
    const outputAdapter = new CodexAdapter(outputTransport, clock());
    await outputAdapter.execute(outputRequest);
    await expect(
      outputAdapter.execute({ ...outputRequest, providerRunId: "provider-run-output-n-plus-1" }),
    ).rejects.toMatchObject({
      category: "policy",
      retryable: false,
      stopReason: "output-token-budget-exhausted",
    });
    expect(outputTransport.invocations).toHaveLength(1);
  });

  it("fails live execution closed when the ledger is process-only", async () => {
    const transport = new FixtureTransport({
      id: "resp_process_only",
      status: "completed",
      model: "codex-test",
      usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
      output: [],
    });
    const processLedger = await ExecutionBudgetLedger.create(
      authorizeExecutionBudgetLineage({
        budgetLineageId: "lineage-process-only",
        workUnitId: baseRequest.workUnitId,
        maxModelCalls: 2,
        maxOutputTokens: 100,
        authorizedAt: "2026-08-09T12:00:00.000Z",
        authorizedBy: "provider-adapter-test",
        authorizationEvidenceId: "test-authority",
      }),
      new InMemoryExecutionBudgetEvidenceStore(),
    );
    const durableRequest = await executionRequest();
    await expect(
      new CodexAdapter(transport).execute({
        ...durableRequest,
        budgetLineageId: processLedger.budgetLineageId,
        budgetLedger: processLedger,
      }),
    ).rejects.toMatchObject({ category: "policy", retryable: false });
    expect(transport.invocations).toHaveLength(0);
  });

  it("records cap-breach usage as VIOLATION and blocks the lineage", async () => {
    const providerRequest = await executionRequest();
    const adapter = new CodexAdapter(
      new FixtureTransport({
        id: "resp_violation",
        status: "completed",
        model: "codex-test",
        usage: { input_tokens: 1, output_tokens: 101, total_tokens: 102 },
        output: [],
      }),
      clock(),
    );
    await expect(adapter.execute(providerRequest)).rejects.toMatchObject({
      category: "policy",
      retryable: false,
    });
    expect(providerRequest.budgetLedger.snapshot()).toMatchObject({
      terminalBudgetReason: "ENFORCEMENT_VIOLATION",
      observedOutputTokens: 101,
      policyChargedOutputTokens: 100,
    });
    await expect(
      adapter.execute({ ...providerRequest, providerRunId: "provider-run-2" }),
    ).rejects.toMatchObject({
      category: "policy",
      retryable: false,
    });
  });

  it("preserves conservative failure evidence when no ProviderRun can be created", async () => {
    const providerRequest = await executionRequest();
    const adapter = new CodexAdapter(new ThrowingTransport({}), clock());
    await expect(adapter.execute(providerRequest)).rejects.toMatchObject({
      category: "transient",
      retryable: true,
    });
    expect(providerRequest.budgetLedger.snapshot()).toMatchObject({
      modelCallsInitiated: 1,
      observedOutputTokens: null,
      policyChargedOutputTokens: 100,
    });
  });

  it("fails opaque multiplicity closed before transport invocation", async () => {
    const providerRequest = await executionRequest();
    const transport = new FixtureTransport(
      {},
      { kind: "opaque", reason: "generation multiplicity is unavailable" },
    );
    await expect(new CodexAdapter(transport).execute(providerRequest)).rejects.toMatchObject({
      category: "policy",
      retryable: false,
    });
    expect(transport.invocations).toHaveLength(0);
    expect(providerRequest.budgetLedger.snapshot()).toMatchObject({
      modelCallsReserved: 0,
      modelCallsInitiated: 0,
    });
  });

  it("fails Codex CLI closed before the subprocess can execute", async () => {
    let executed = false;
    const cli = new CodexCliTransport(".", async () => {
      executed = true;
      return { stdout: "", stderr: "" };
    });
    const providerRequest = await executionRequest();
    await expect(new CodexAdapter(cli).execute(providerRequest)).rejects.toMatchObject({
      category: "policy",
      retryable: false,
    });
    expect(executed).toBe(false);
    expect(providerRequest.budgetLedger.snapshot().reservations).toHaveLength(0);
  });

  it("keeps model-call and output-token terminal reasons distinct", () => {
    expect(extractClaudeResult({ stop_reason: "max_tokens", content: [] }).stopReason).toBe(
      "output-token-budget-exhausted",
    );
    expect(
      extractCodexResult({
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
        output: [],
      }).stopReason,
    ).toBe("output-token-budget-exhausted");
  });

  it("fails closed when no live transport is configured", async () => {
    await expect(new ClaudeAdapter().execute(await executionRequest())).rejects.toMatchObject({
      category: "policy",
      retryable: false,
    });
  });

  it("normalizes malformed provider data into an invalid-response error", async () => {
    const adapter = new CodexAdapter(
      new FixtureTransport({ status: "completed", usage: {}, output: [] }),
      clock(),
    );
    await expect(adapter.execute(await executionRequest())).rejects.toMatchObject({
      category: "invalid-response",
      retryable: false,
    });
  });

  it("retains authoritative budget evidence when result normalization later fails", async () => {
    const providerRequest = await executionRequest();
    const adapter = new CodexAdapter(
      new FixtureTransport({
        id: "resp_missing_model",
        status: "completed",
        usage: { input_tokens: 4, output_tokens: 2, total_tokens: 6 },
        output: [],
      }),
      clock(),
    );
    await expect(adapter.execute(providerRequest)).rejects.toMatchObject({
      category: "invalid-response",
      retryable: false,
    });
    expect(providerRequest.budgetLedger.snapshot()).toMatchObject({
      modelCallsInitiated: 1,
      observedOutputTokens: 2,
      policyChargedOutputTokens: 2,
      reservations: [{ state: "SETTLED_AUTHORITATIVE" }],
    });
  });

  it("normalizes transport failures without exposing credentials", async () => {
    const transport = new HttpProviderTransport(
      { openaiApiKey: "synthetic-test-key" },
      async () => {
        throw new TypeError("network unavailable");
      },
    );
    await expect(transport.invoke("codex", { input: "test" })).rejects.toMatchObject({
      category: "transient",
      retryable: true,
    });
  });

  it("executes the provider/evidence/QA/review/audit telemetry slice", async () => {
    const root = await mkdtemp(join(tmpdir(), "beacon-live-slice-"));
    const contextPackage = runContextPreflight({
      workUnitId: baseRequest.workUnitId,
      objective: "Return ready",
      agentRole: "code-writer",
      riskClass: "risk-1",
      contractSha256: "d".repeat(64),
      maxContextTokens: 1000,
      allowedPaths: ["src"],
      allowedTools: ["Read"],
      acceptanceCriteria: ["Output is ready"],
      searchTerms: ["ready"],
      candidates: [],
    });
    const adapter = new CodexAdapter(
      new FixtureTransport({
        id: "resp_2",
        status: "completed",
        model: "codex-test",
        usage: {
          input_tokens: 4,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens: 1,
          output_tokens_details: { reasoning_tokens: 0 },
          total_tokens: 5,
        },
        output: [{ type: "message", content: [{ type: "output_text", text: "ready" }] }],
      }),
      clock(),
    );
    const budgetRequest = await executionRequest();
    const result = await executeLiveWorkUnit(
      {
        ...baseRequest,
        contextPackage,
        agentRole: "code-writer",
        contractVersion: "1",
        contractSha256: "d".repeat(64),
      },
      {
        adapter,
        budgetLedger: budgetRequest.budgetLedger,
        telemetrySink: createLocalTelemetrySink(root, "required"),
        validate: async (providerResult) => ({
          passed: providerResult.outputText === "ready",
          evidenceId: "qa-1",
          summary: "Exact output validated.",
        }),
        review: async () => ({
          passed: true,
          evidenceId: "review-1",
          summary: "Independent bounded review passed.",
          provider: "claude",
          sessionId: "review-session-1",
          blockerCount: 0,
          majorCount: 0,
        }),
        now: clock(),
      },
    );
    expect(result.agentRun.outcome).toMatchObject({
      qaPassed: true,
      reviewDisposition: "approved",
      finalState: "complete",
    });
    expect(result.evidence).toHaveLength(3);
    expect(
      (await readFile(join(root, ".beacon/telemetry/agent-runs.ndjson"), "utf8")).trim(),
    ).toContain("agent-run-1");
  });

  it("exposes normalized provider error categories without credentials", () => {
    expect(
      new ProviderExecutionError("codex", "capacity", "rate limited", true, 429),
    ).toMatchObject({ category: "capacity", retryable: true, statusCode: 429 });
  });
});
