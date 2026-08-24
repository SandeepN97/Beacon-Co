import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runContextPreflight } from "../../src/modules/orchestration/context/preflight.ts";
import { validateAgentRun } from "../../src/modules/orchestration/domain/agent-run.ts";
import type { WorkRequest } from "../../src/modules/orchestration/domain/work-request.ts";
import type { RetrievedContextPackage } from "../../src/modules/orchestration/knowledge/context-packager.ts";
import { ClaudeAdapter } from "../../src/modules/orchestration/providers/claude/claude-adapter.ts";
import { CodexAdapter } from "../../src/modules/orchestration/providers/codex/codex-adapter.ts";
import {
  GROQ_CREDENTIAL_ENV_VAR,
  HarnessAdapter,
  OpenCodeProcessTransport,
  type HarnessProcessResult,
  type HarnessTransport,
} from "../../src/modules/orchestration/providers/harness/harness-adapter.ts";
import { parseOpenCodeStdout } from "../../src/modules/orchestration/providers/harness/opencode-normalizer.ts";
import type { ProviderAdapter } from "../../src/modules/orchestration/providers/provider-adapter.ts";
import { createLocalTelemetrySink } from "../../src/modules/orchestration/telemetry/sink.ts";
import { executeLiveWorkUnit } from "../../src/modules/orchestration/workflows/live-work-unit.ts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

class FixtureHarnessTransport implements HarnessTransport {
  constructor(private readonly result: HarnessProcessResult) {}

  async invoke(): Promise<HarnessProcessResult> {
    return this.result;
  }
}

const request: WorkRequest = {
  id: "request-1",
  rawRequest: "inspect the repository",
  normalizedGoal: "inspect the repository",
  businessOutcome: "repository behavior is understood",
  workflowType: "implementation",
  requestedDeliverables: [],
  acceptanceCriteria: ["findings are recorded"],
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
  recommendedFirstRole: "codebase-researcher",
  preferredProvider: "auto",
  providerReason: "no preference",
  documentationImpactExpected: false,
  status: "ready-for-routing",
};

const context: RetrievedContextPackage = {
  requestId: request.id,
  approvedDocuments: [],
  adrConstraints: [],
  conflicts: [],
};

const processOutput = [
  {
    type: "step_start",
    timestamp: 1,
    sessionID: "session-1",
    part: { type: "step-start" },
  },
  {
    type: "tool_use",
    timestamp: 2,
    sessionID: "session-1",
    part: {
      type: "tool",
      callID: "call-1",
      tool: "read",
      state: { status: "completed", input: { path: "README.md" }, output: "redacted" },
    },
  },
  {
    type: "step_finish",
    timestamp: 3,
    sessionID: "session-1",
    part: {
      type: "step-finish",
      reason: "tool-calls",
      tokens: { input: 100, output: 20, reasoning: 5, cache: { read: 50, write: 0 } },
    },
  },
  {
    type: "text",
    timestamp: 4,
    sessionID: "session-1",
    part: { type: "text", text: "ready" },
  },
  {
    type: "step_finish",
    timestamp: 5,
    sessionID: "session-1",
    part: {
      type: "step-finish",
      reason: "stop",
      tokens: { input: 80, output: 10, reasoning: 2, cache: { read: 60, write: 0 } },
    },
  },
]
  .map((event) => JSON.stringify(event))
  .join("\n");

function clock() {
  const values = [new Date("2026-08-24T12:00:00.000Z"), new Date("2026-08-24T12:00:00.250Z")];
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

describe("HarnessAdapter contract conformance", () => {
  it("satisfies the exact ProviderAdapter interface Claude and Codex implement", () => {
    const adapter = new HarnessAdapter({
      repositoryRoot: "/fixture/repository",
      transport: new FixtureHarnessTransport({ stdout: processOutput, stderr: "", exitCode: 0 }),
    });
    const adapters: ProviderAdapter[] = [new ClaudeAdapter(), new CodexAdapter(), adapter];
    expect(adapters.map(({ provider }) => provider)).toEqual(["claude", "codex", "groq"]);
    expect(adapter.simulate(request, context)).toMatchObject({
      provider: "groq",
      liveInvocation: false,
      prompt: { provider: "groq", requestId: "request-1" },
    });
  });

  it("propagates the executable path and required Groq credential", async () => {
    let invocation: { file: string; args: string[]; environment: NodeJS.ProcessEnv } | undefined;
    const transport = new OpenCodeProcessTransport({
      repositoryRoot: "/fixture/repository",
      environment: { Path: "/fixture/bin", [GROQ_CREDENTIAL_ENV_VAR]: "fixture-value" },
      processRunner: async (file, args, options) => {
        invocation = { file, args, environment: options.env };
        return { stdout: processOutput, stderr: "", exitCode: 0 };
      },
    });
    await transport.invoke({
      resolvedModelId: "groq/openai/gpt-oss-120b",
      prompt: "bounded prompt",
    });
    expect(invocation).toEqual({
      file: "opencode",
      args: ["run", "--format", "json", "--model", "groq/openai/gpt-oss-120b", "bounded prompt"],
      environment: {
        PATH: "/fixture/bin",
        [GROQ_CREDENTIAL_ENV_VAR]: "fixture-value",
      },
    });
  });

  it("fails safely without GROQ_API_KEY and never starts the child", async () => {
    let invoked = false;
    const transport = new OpenCodeProcessTransport({
      repositoryRoot: "/fixture/repository",
      environment: { PATH: "/fixture/bin", OPENAI_API_KEY: "unrelated-openai-value" },
      processRunner: async () => {
        invoked = true;
        return { stdout: processOutput, stderr: "", exitCode: 0 };
      },
    });

    await expect(
      transport.invoke({
        resolvedModelId: "groq/openai/gpt-oss-120b",
        prompt: "bounded prompt",
      }),
    ).rejects.toMatchObject({
      provider: "groq",
      category: "authentication",
      retryable: false,
    });
    expect(invoked).toBe(false);
  });

  it("does not propagate unrelated parent credentials, configuration, or process controls", async () => {
    let childEnvironment: NodeJS.ProcessEnv | undefined;
    const transport = new OpenCodeProcessTransport({
      repositoryRoot: "/fixture/repository",
      environment: {
        PATH: "/fixture/bin",
        [GROQ_CREDENTIAL_ENV_VAR]: "fixture-value",
        OPENAI_API_KEY: "unrelated-openai-value",
        ANTHROPIC_API_KEY: "unrelated-anthropic-value",
        AWS_SECRET_ACCESS_KEY: "unrelated-aws-value",
        GITHUB_TOKEN: "unrelated-github-value",
        CLOUDFLARE_API_TOKEN: "unrelated-cloudflare-value",
        RESEND_API_KEY: "unrelated-resend-value",
        DATABASE_URL: "postgresql://unrelated.invalid/beacon",
        HOME: "/unrestricted/home",
        NODE_OPTIONS: "--require=/untrusted/bootstrap.cjs",
        HTTPS_PROXY: "https://unrelated-proxy.invalid",
        UNRELATED_SECRET: "unrelated-value",
      },
      processRunner: async (_file, _args, options) => {
        childEnvironment = options.env;
        return { stdout: processOutput, stderr: "", exitCode: 0 };
      },
    });

    await transport.invoke({
      resolvedModelId: "groq/openai/gpt-oss-120b",
      prompt: "bounded prompt",
    });

    expect(childEnvironment).toEqual({
      PATH: "/fixture/bin",
      [GROQ_CREDENTIAL_ENV_VAR]: "fixture-value",
    });
    expect(childEnvironment).not.toHaveProperty("OPENAI_API_KEY");
    expect(childEnvironment).not.toHaveProperty("ANTHROPIC_API_KEY");
    expect(childEnvironment).not.toHaveProperty("AWS_SECRET_ACCESS_KEY");
    expect(childEnvironment).not.toHaveProperty("GITHUB_TOKEN");
    expect(childEnvironment).not.toHaveProperty("CLOUDFLARE_API_TOKEN");
    expect(childEnvironment).not.toHaveProperty("RESEND_API_KEY");
    expect(childEnvironment).not.toHaveProperty("DATABASE_URL");
    expect(childEnvironment).not.toHaveProperty("HOME");
    expect(childEnvironment).not.toHaveProperty("NODE_OPTIONS");
    expect(childEnvironment).not.toHaveProperty("HTTPS_PROXY");
    expect(childEnvironment).not.toHaveProperty("UNRELATED_SECRET");
  });
});

describe("OpenCode subprocess normalization", () => {
  it("parses stdout through ProviderAdapter into the shared AgentRun schema", async () => {
    const root = await mkdtemp(join(tmpdir(), "beacon-harness-"));
    temporaryDirectories.push(root);
    const contextPackage = runContextPreflight({
      workUnitId: "work-unit-1",
      objective: "Inspect the repository",
      agentRole: "codebase-researcher",
      riskClass: "risk-0",
      contractSha256: "a".repeat(64),
      maxContextTokens: 1000,
      allowedPaths: ["src"],
      allowedTools: ["Read"],
      acceptanceCriteria: ["Findings are recorded"],
      searchTerms: ["repository"],
      candidates: [],
    });
    const adapter = new HarnessAdapter({
      repositoryRoot: root,
      transport: new FixtureHarnessTransport({ stdout: processOutput, stderr: "", exitCode: 0 }),
      now: clock(),
    });
    const result = await executeLiveWorkUnit(
      {
        agentRunId: "agent-run-1",
        providerRunId: "provider-run-1",
        workUnitId: "work-unit-1",
        agentRole: "codebase-researcher",
        contractVersion: "1",
        contractSha256: "a".repeat(64),
        contextPackage,
        prompt: "bounded prompt",
        compilationHash: "b".repeat(64),
        resolvedModelId: "groq/openai/gpt-oss-120b",
        requestedEffort: null,
        maxOutputTokens: 100,
        maxTurns: 2,
      },
      {
        adapter,
        telemetrySink: createLocalTelemetrySink(root, "required"),
        validate: async ({ outputText }) => ({
          passed: outputText === "ready",
          evidenceId: "qa-1",
          summary: "Output matched.",
        }),
        review: async () => ({
          passed: true,
          evidenceId: "review-1",
          summary: "Review passed.",
          provider: "codex",
          sessionId: "review-session-1",
          blockerCount: 0,
          majorCount: 0,
        }),
        now: clock(),
      },
    );

    expect(validateAgentRun(result.agentRun)).toEqual(result.agentRun);
    expect(result.agentRun).toMatchObject({
      provider: "groq",
      resolvedModelId: "groq/openai/gpt-oss-120b",
      status: "succeeded",
      context: {
        usage: {
          totalInputTokens: 290,
          cachedInputTokens: 110,
          cacheWriteTokens: 0,
          uncachedInputTokens: 180,
          outputTokens: 30,
          reasoningTokens: 7,
          totalTokens: 320,
        },
      },
      execution: { turns: 2, toolCallCount: 1 },
    });
    expect(result.providerResult.providerRun.providerMetadata).toMatchObject({
      harness: "opencode",
      backend: "groq",
      usageEstimated: false,
    });
  });

  it("fails closed on malformed or incomplete OpenCode JSON output", () => {
    expect(() => parseOpenCodeStdout("not-json")).toThrow("malformed JSONL");
    expect(() =>
      parseOpenCodeStdout(JSON.stringify({ type: "step_start", part: { type: "step-start" } })),
    ).toThrow("step_finish");
  });
});
