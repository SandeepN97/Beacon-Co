import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { validateAgentRun } from "../../src/modules/orchestration/domain/agent-run";
import { validateProviderRun } from "../../src/modules/orchestration/domain/provider-run";
import {
  normalizeAnthropicUsage,
  normalizeOpenAIUsage,
} from "../../src/modules/orchestration/telemetry/normalize-usage";
import { prepareProviderRun } from "../../src/modules/orchestration/telemetry/redaction";
import {
  AppendOnlyNdjsonTelemetrySink,
  createCiTelemetrySink,
  createLocalTelemetrySink,
  TelemetryPersistenceError,
} from "../../src/modules/orchestration/telemetry/sink";

const temporaryDirectories: string[] = [];
const sha = (character: string) => character.repeat(64);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "beacon-telemetry-"));
  temporaryDirectories.push(directory);
  return directory;
}

const emptyUsage = () => ({
  totalInputTokens: null,
  cachedInputTokens: null,
  cacheWriteTokens: null,
  uncachedInputTokens: null,
  outputTokens: null,
  reasoningTokens: null,
  totalTokens: null,
});

const providerRunFixture = () => ({
  schemaVersion: 1 as const,
  id: "provider-run-1",
  agentRunId: "agent-run-1",
  workUnitId: "work-unit-1",
  taskFingerprint: sha("a"),
  provider: "claude" as const,
  resolvedModelId: "claude-test-model",
  requestedEffort: "medium",
  startedAt: "2026-08-09T12:00:00.000Z",
  completedAt: "2026-08-09T12:00:01.250Z",
  durationMs: 1250,
  status: "succeeded" as const,
  stopReason: "completed" as const,
  usage: emptyUsage(),
  turns: 2,
  toolCallCount: 3,
  retryCount: 0,
  fallbackUsed: false,
  handoffUsed: false,
  providerMetadata: {},
});

const agentRunFixture = () => ({
  schemaVersion: 1 as const,
  id: "agent-run-1",
  workUnitId: "work-unit-1",
  taskFingerprint: sha("a"),
  agentRole: "code-writer" as const,
  contractVersion: "1.5/1",
  contractSha256: sha("b"),
  riskClass: "risk-1" as const,
  provider: "codex" as const,
  resolvedModelId: "codex-test-model",
  requestedEffort: "medium",
  startedAt: "2026-08-09T12:00:00.000Z",
  completedAt: "2026-08-09T12:00:02.000Z",
  durationMs: 2000,
  status: "succeeded" as const,
  stopReason: "completed" as const,
  providerRunIds: ["provider-run-1"],
  context: {
    contextBytes: 4096,
    estimatedInputTokens: 1024,
    usage: emptyUsage(),
    referencedFiles: [
      {
        path: "src/modules/orchestration/index.ts",
        sha256: sha("c"),
        classification: "internal" as const,
      },
    ],
    readFileCount: 2,
    changedFileCount: 1,
    compilationHash: sha("d"),
  },
  execution: {
    turns: 2,
    toolCallCount: 3,
    retryCount: 0,
    fallbackUsed: false,
    handoffUsed: false,
    policyDecisions: { allow: 3, ask: 0, deny: 0 },
  },
  outcome: {
    authorValidationPassed: true,
    qaPassed: null,
    reviewDisposition: "not-reviewed" as const,
    blockingFindingCount: 0,
    majorFindingCount: 0,
    finalState: "review" as const,
  },
  evidenceIds: ["evidence-1"],
});

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("provider usage normalization", () => {
  it("normalizes Anthropic cache input into Beacon token concepts", () => {
    expect(
      normalizeAnthropicUsage({
        input_tokens: 900,
        cache_creation_input_tokens: 100,
        cache_read_input_tokens: 4000,
        output_tokens: 500,
      }),
    ).toEqual({
      totalInputTokens: 5000,
      cachedInputTokens: 4000,
      cacheWriteTokens: 100,
      uncachedInputTokens: 900,
      outputTokens: 500,
      reasoningTokens: null,
      totalTokens: 5500,
    });
  });

  it("normalizes OpenAI cached and reasoning usage", () => {
    expect(
      normalizeOpenAIUsage({
        input_tokens: 5000,
        input_tokens_details: { cached_tokens: 3500 },
        output_tokens: 800,
        output_tokens_details: { reasoning_tokens: 300 },
        total_tokens: 5800,
      }),
    ).toEqual({
      totalInputTokens: 5000,
      cachedInputTokens: 3500,
      cacheWriteTokens: null,
      uncachedInputTokens: 1500,
      outputTokens: 800,
      reasoningTokens: 300,
      totalTokens: 5800,
    });
  });

  it("rejects negative, non-integer, and internally inconsistent usage", () => {
    expect(() => normalizeAnthropicUsage({ input_tokens: -1 })).toThrow(
      "input_tokens must be a non-negative integer",
    );
    expect(() => normalizeOpenAIUsage({ input_tokens: 1.5 })).toThrow(
      "input_tokens must be a non-negative integer",
    );
    expect(() =>
      normalizeOpenAIUsage({
        input_tokens: 10,
        input_tokens_details: { cached_tokens: 11 },
      }),
    ).toThrow("cached_tokens cannot exceed input_tokens");
    expect(() =>
      normalizeOpenAIUsage({ input_tokens: 10, output_tokens: 5, total_tokens: 16 }),
    ).toThrow("total_tokens must equal input_tokens plus output_tokens");
    expect(() => normalizeAnthropicUsage({ output_tokens: 10 })).toThrow(
      "input_tokens is required",
    );
  });
});

describe("telemetry validation and redaction", () => {
  it("accepts normalized AgentRun and ProviderRun records", () => {
    expect(validateAgentRun(agentRunFixture()).id).toBe("agent-run-1");
    expect(validateProviderRun(providerRunFixture()).id).toBe("provider-run-1");
  });

  it("rejects malformed records and raw prompt fields", () => {
    expect(() => validateAgentRun({ ...agentRunFixture(), rawPrompt: "do not persist" })).toThrow();
    expect(() =>
      validateAgentRun({
        ...agentRunFixture(),
        context: {
          ...agentRunFixture().context,
          referencedFiles: [
            {
              path: "../outside.txt",
              sha256: sha("c"),
              classification: "internal",
            },
          ],
        },
      }),
    ).toThrow("referenced paths must be repository-relative");
    expect(() => validateProviderRun({ ...providerRunFixture(), durationMs: -1 })).toThrow();
    expect(() =>
      validateProviderRun({
        ...providerRunFixture(),
        usage: {
          ...emptyUsage(),
          totalInputTokens: 100,
          cachedInputTokens: 80,
          uncachedInputTokens: 30,
        },
      }),
    ).toThrow("normalized input token components must equal totalInputTokens");
    expect(() =>
      validateProviderRun({
        ...providerRunFixture(),
        status: "running",
        completedAt: null,
        durationMs: null,
        stopReason: "completed",
      }),
    ).toThrow("open runs cannot have a stopReason");
  });

  it("redacts sensitive provider metadata and bounds unknown values", () => {
    const prepared = prepareProviderRun({
      ...providerRunFixture(),
      providerMetadata: {
        input_tokens: 20,
        authorization: "Bearer synthetic-credential-value",
        api_key: "tiny",
        prompt: "customer draft",
        nested: { note: "safe", output: "x".repeat(600) },
      },
    });
    expect(prepared.providerMetadata).toMatchObject({
      input_tokens: 20,
      authorization: "[REDACTED]",
      api_key: "[REDACTED]",
      prompt: "[REDACTED]",
      nested: { note: "safe" },
    });
    expect(JSON.stringify(prepared)).not.toContain("synthetic-credential-value");
    expect(String((prepared.providerMetadata.nested as Record<string, unknown>).output)).toContain(
      "[TRUNCATED]",
    );
  });
});

describe("append-only telemetry sinks", () => {
  it("loads the telemetry runtime through the supported Node CLI path", () => {
    expect(() =>
      execFileSync(
        process.execPath,
        [
          "--disable-warning=ExperimentalWarning",
          "--experimental-strip-types",
          "--input-type=module",
          "--eval",
          "await import('./src/modules/orchestration/telemetry/sink.ts')",
        ],
        { cwd: repositoryRoot, encoding: "utf8" },
      ),
    ).not.toThrow();
  });

  it("appends validated local records as NDJSON under the ignored telemetry path", async () => {
    const repositoryRoot = await temporaryDirectory();
    const sink = createLocalTelemetrySink(repositoryRoot);
    const first = await sink.append("agent-run", agentRunFixture());
    const second = await sink.append("agent-run", {
      ...agentRunFixture(),
      id: "agent-run-2",
    });
    expect(first.persisted).toBe(true);
    expect(second.persisted).toBe(true);
    const lines = (
      await readFile(join(repositoryRoot, ".beacon/telemetry/agent-runs.ndjson"), "utf8")
    )
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(lines.map(({ id }) => id)).toEqual(["agent-run-1", "agent-run-2"]);
  });

  it("writes redacted provider records to the CI evidence boundary", async () => {
    const repositoryRoot = await temporaryDirectory();
    const sink = createCiTelemetrySink(repositoryRoot, "required");
    const result = await sink.append("provider-run", {
      ...providerRunFixture(),
      providerMetadata: { secret: "tiny" },
    });
    expect(result.persisted).toBe(true);
    const source = await readFile(
      join(repositoryRoot, "evidence/telemetry/provider-runs.ndjson"),
      "utf8",
    );
    expect(source).toContain("[REDACTED]");
    expect(source).not.toContain('"secret":"tiny"');
  });

  it("reports best-effort persistence failure without invalidating the run", async () => {
    const repositoryRoot = await temporaryDirectory();
    const blockedPath = join(repositoryRoot, "directory-instead-of-file");
    await mkdir(blockedPath);
    const sink = new AppendOnlyNdjsonTelemetrySink(
      { "agent-run": blockedPath, "provider-run": blockedPath },
      "best-effort",
    );
    await expect(sink.append("agent-run", agentRunFixture())).resolves.toMatchObject({
      persisted: false,
      errorCode: "telemetry-write-failed",
      recordId: "agent-run-1",
    });
  });

  it("makes persistence failure blocking only in required mode", async () => {
    const repositoryRoot = await temporaryDirectory();
    const blockedPath = join(repositoryRoot, "directory-instead-of-file");
    await mkdir(blockedPath);
    const sink = new AppendOnlyNdjsonTelemetrySink(
      { "agent-run": blockedPath, "provider-run": blockedPath },
      "required",
    );
    await expect(sink.append("provider-run", providerRunFixture())).rejects.toBeInstanceOf(
      TelemetryPersistenceError,
    );
  });
});
