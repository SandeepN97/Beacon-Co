import { createHash } from "node:crypto";
import type { NormalizedTokenUsage } from "../../domain/provider-run.ts";
import { prepareProviderRun } from "../../telemetry/redaction.ts";
import {
  ProviderExecutionError,
  type ProviderExecutionRequest,
  type ProviderExecutionResult,
} from "../provider-adapter.ts";

type UnknownRecord = Record<string, unknown>;

export interface ParsedOpenCodeOutput {
  sessionId: string | null;
  outputText: string;
  finishReason: string;
  usage: NormalizedTokenUsage;
  usageEstimated: boolean;
  turns: number;
  tools: ProviderExecutionResult["toolEvidence"];
}

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function nonnegativeInteger(value: unknown): number | null {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : null;
}

function emptyUsage(): NormalizedTokenUsage {
  return {
    totalInputTokens: null,
    cachedInputTokens: null,
    cacheWriteTokens: null,
    uncachedInputTokens: null,
    outputTokens: null,
    reasoningTokens: null,
    totalTokens: null,
  };
}

/** Parses OpenCode's documented `run --format json` NDJSON event stream. */
export function parseOpenCodeStdout(stdout: string): ParsedOpenCodeOutput {
  const lines = stdout.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    throw new ProviderExecutionError(
      "groq",
      "invalid-response",
      "OpenCode returned no JSON events.",
      false,
    );
  }

  let events: UnknownRecord[];
  try {
    events = lines.map((line) => record(JSON.parse(line)));
  } catch {
    throw new ProviderExecutionError(
      "groq",
      "invalid-response",
      "OpenCode returned malformed JSONL.",
      false,
    );
  }

  if (events.some((event) => event.type === "error")) {
    throw new ProviderExecutionError(
      "groq",
      "invalid-response",
      "OpenCode reported an error event.",
      false,
    );
  }

  const text = events
    .filter((event) => event.type === "text")
    .map((event) => record(event.part).text)
    .filter((value): value is string => typeof value === "string")
    .join("\n");
  const steps = events.filter((event) => event.type === "step_finish");
  if (steps.length === 0) {
    throw new ProviderExecutionError(
      "groq",
      "invalid-response",
      "OpenCode did not emit a final step_finish event.",
      false,
    );
  }
  const finalPart = record(steps.at(-1)?.part);
  const finishReason = typeof finalPart.reason === "string" ? finalPart.reason : "unknown";

  let uncachedInputTokens = 0;
  let cachedInputTokens = 0;
  let cacheWriteTokens = 0;
  let outputTokens = 0;
  let reasoningTokens = 0;
  let completeUsage = true;
  for (const step of steps) {
    const tokens = record(record(step.part).tokens);
    const cache = record(tokens.cache);
    const input = nonnegativeInteger(tokens.input);
    const output = nonnegativeInteger(tokens.output);
    const reasoning = nonnegativeInteger(tokens.reasoning);
    const cacheRead = nonnegativeInteger(cache.read);
    const cacheWrite = nonnegativeInteger(cache.write);
    if (
      input === null ||
      output === null ||
      reasoning === null ||
      cacheRead === null ||
      cacheWrite === null
    ) {
      completeUsage = false;
      continue;
    }
    uncachedInputTokens += input;
    outputTokens += output;
    reasoningTokens += reasoning;
    cachedInputTokens += cacheRead;
    cacheWriteTokens += cacheWrite;
  }

  const usage = completeUsage
    ? {
        totalInputTokens: uncachedInputTokens + cachedInputTokens + cacheWriteTokens,
        cachedInputTokens,
        cacheWriteTokens,
        uncachedInputTokens,
        outputTokens,
        reasoningTokens,
        totalTokens: uncachedInputTokens + cachedInputTokens + cacheWriteTokens + outputTokens,
      }
    : emptyUsage();
  const tools = events
    .filter((event) => event.type === "tool_use")
    .map((event) => record(event.part))
    .map((part) => ({
      toolCallId: typeof part.callID === "string" ? part.callID : "unknown-tool-call",
      toolName: typeof part.tool === "string" ? part.tool : "unknown-tool",
      inputFingerprint: createHash("sha256")
        .update(JSON.stringify(record(part.state).input ?? {}))
        .digest("hex"),
    }));
  const sessionId = events.find((event) => typeof event.sessionID === "string")?.sessionID;

  return {
    sessionId: typeof sessionId === "string" ? sessionId : null,
    outputText: text,
    finishReason,
    usage,
    usageEstimated: !completeUsage,
    turns: steps.length,
    tools,
  };
}

function stopReason(finishReason: string): "completed" | "max-turns" | "provider-error" {
  if (finishReason === "stop") return "completed";
  if (finishReason === "length" || finishReason === "max-tokens") return "max-turns";
  return "provider-error";
}

/** Section 29B.10.2 step 5: normalize the subprocess stream at the adapter boundary. */
export function normalizeOpenCodeResult(
  stdout: string,
  request: ProviderExecutionRequest,
  startedAt: Date,
  completedAt: Date,
): ProviderExecutionResult {
  const parsed = parseOpenCodeStdout(stdout);
  const normalizedStopReason = stopReason(parsed.finishReason);
  const providerRun = prepareProviderRun({
    schemaVersion: 1,
    id: request.providerRunId,
    agentRunId: request.agentRunId,
    workUnitId: request.workUnitId,
    taskFingerprint: request.taskFingerprint,
    provider: "groq",
    resolvedModelId: request.resolvedModelId,
    requestedEffort: request.requestedEffort,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
    status: normalizedStopReason === "completed" ? "succeeded" : "failed",
    stopReason: normalizedStopReason,
    usage: parsed.usage,
    turns: parsed.turns,
    toolCallCount: parsed.tools.length,
    retryCount: 0,
    fallbackUsed: false,
    handoffUsed: false,
    providerMetadata: {
      harness: "opencode",
      backend: "groq",
      sessionId: parsed.sessionId,
      nativeStopReason: parsed.finishReason,
      usageEstimated: parsed.usageEstimated,
      compilationHash: request.compilationHash,
    },
  });
  return { providerRun, outputText: parsed.outputText, toolEvidence: parsed.tools };
}
