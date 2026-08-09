import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runContextPreflight } from "../../src/modules/orchestration/context/preflight.ts";
import { ClaudeAdapter } from "../../src/modules/orchestration/providers/claude/claude-adapter.ts";
import { CodexAdapter } from "../../src/modules/orchestration/providers/codex/codex-adapter.ts";
import { HttpProviderTransport } from "../../src/modules/orchestration/providers/http-provider-transport.ts";
import {
  ProviderExecutionError,
  type ProviderTransport,
} from "../../src/modules/orchestration/providers/provider-adapter.ts";
import { createLocalTelemetrySink } from "../../src/modules/orchestration/telemetry/sink.ts";
import { executeLiveWorkUnit } from "../../src/modules/orchestration/workflows/live-work-unit.ts";

class FixtureTransport implements ProviderTransport {
  constructor(private readonly response: Record<string, unknown>) {}
  async invoke() {
    return this.response;
  }
}

const request = {
  providerRunId: "provider-run-1",
  agentRunId: "agent-run-1",
  workUnitId: "work-unit-1",
  taskFingerprint: "b".repeat(64),
  prompt: "Return the word ready.",
  compilationHash: "c".repeat(64),
  resolvedModelId: "requested-model",
  requestedEffort: "medium",
  maxOutputTokens: 100,
  maxTurns: 2,
};

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
    const result = await adapter.execute(request);
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
    const result = await adapter.execute(request);
    expect(result.providerRun.usage).toMatchObject({
      totalInputTokens: 20,
      cachedInputTokens: 8,
      uncachedInputTokens: 12,
      reasoningTokens: 2,
    });
    expect(result.toolEvidence).toMatchObject([{ toolCallId: "call_1", toolName: "read_file" }]);
  });

  it("fails closed when no live transport is configured", async () => {
    await expect(new ClaudeAdapter().execute(request)).rejects.toMatchObject({
      category: "policy",
      retryable: false,
    });
  });

  it("normalizes malformed provider data into an invalid-response error", async () => {
    const adapter = new CodexAdapter(
      new FixtureTransport({ status: "completed", usage: {}, output: [] }),
      clock(),
    );
    await expect(adapter.execute(request)).rejects.toMatchObject({
      category: "invalid-response",
      retryable: false,
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
      workUnitId: request.workUnitId,
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
    const result = await executeLiveWorkUnit(
      {
        ...request,
        contextPackage,
        agentRole: "code-writer",
        contractVersion: "1",
        contractSha256: "d".repeat(64),
      },
      {
        adapter,
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
