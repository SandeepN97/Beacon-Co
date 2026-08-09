import { createHash } from "node:crypto";
import type { ProviderId } from "../domain/provider.ts";
import type { ProviderRun } from "../domain/provider-run.ts";
import { normalizeProviderUsage } from "../telemetry/normalize-usage.ts";
import { prepareProviderRun } from "../telemetry/redaction.ts";
import {
  ProviderExecutionError,
  type ProviderExecutionRequest,
  type ProviderExecutionResult,
} from "./provider-adapter.ts";

type StopReason = Exclude<ProviderRun["stopReason"], null>;

interface ExtractedProviderResult {
  outputText: string;
  tools: Array<{ toolCallId: string; toolName: string; inputFingerprint: string }>;
  stopReason: StopReason;
  succeeded: boolean;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProviderExecutionError(
      "codex",
      "invalid-response",
      `${label} must be an object.`,
      false,
    );
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function extractClaudeResult(response: Record<string, unknown>): ExtractedProviderResult {
  const blocks = Array.isArray(response.content) ? response.content : [];
  const outputText = blocks
    .map((block) =>
      record(block, "Claude content block").type === "text"
        ? stringValue(record(block, "Claude content block").text)
        : null,
    )
    .filter((value): value is string => value !== null)
    .join("\n");
  const tools = blocks
    .map((block) => record(block, "Claude content block"))
    .filter((block) => block.type === "tool_use")
    .map((block) => ({
      toolCallId: stringValue(block.id) ?? "unknown-tool-call",
      toolName: stringValue(block.name) ?? "unknown-tool",
      inputFingerprint: createHash("sha256")
        .update(JSON.stringify(block.input ?? {}))
        .digest("hex"),
    }));
  const nativeStop = stringValue(response.stop_reason);
  const stopReason: StopReason =
    nativeStop === "max_tokens" ? "max-turns" : nativeStop === "tool_use" ? "blocked" : "completed";
  return { outputText, tools, stopReason, succeeded: stopReason === "completed" };
}

export function extractCodexResult(response: Record<string, unknown>): ExtractedProviderResult {
  const output = Array.isArray(response.output) ? response.output : [];
  const outputText = output
    .flatMap((item) => {
      const entry = record(item, "OpenAI output item");
      const content = Array.isArray(entry.content) ? entry.content : [];
      return content.map((part) => {
        const value = record(part, "OpenAI output content");
        return value.type === "output_text" ? stringValue(value.text) : null;
      });
    })
    .filter((value): value is string => value !== null)
    .join("\n");
  const tools = output
    .map((item) => record(item, "OpenAI output item"))
    .filter((item) => item.type === "function_call")
    .map((item) => ({
      toolCallId: stringValue(item.call_id) ?? stringValue(item.id) ?? "unknown-tool-call",
      toolName: stringValue(item.name) ?? "unknown-tool",
      inputFingerprint: createHash("sha256")
        .update(String(item.arguments ?? ""))
        .digest("hex"),
    }));
  const status = stringValue(response.status);
  const incomplete =
    response.incomplete_details && typeof response.incomplete_details === "object"
      ? (response.incomplete_details as Record<string, unknown>)
      : {};
  const stopReason: StopReason =
    status === "completed"
      ? "completed"
      : incomplete.reason === "max_output_tokens"
        ? "max-turns"
        : "provider-error";
  return { outputText, tools, stopReason, succeeded: status === "completed" };
}

export function buildProviderResult(options: {
  provider: ProviderId;
  request: ProviderExecutionRequest;
  response: Record<string, unknown>;
  startedAt: Date;
  completedAt: Date;
  extraction: ExtractedProviderResult;
}): ProviderExecutionResult {
  const { provider, request, response, extraction, startedAt, completedAt } = options;
  const model = stringValue(response.model);
  if (!model)
    throw new ProviderExecutionError(
      provider,
      "invalid-response",
      "Provider response omitted resolved model identity.",
      false,
    );
  const providerRun: ProviderRun = prepareProviderRun({
    schemaVersion: 1,
    id: request.providerRunId,
    agentRunId: request.agentRunId,
    workUnitId: request.workUnitId,
    taskFingerprint: request.taskFingerprint,
    provider,
    resolvedModelId: model,
    requestedEffort: request.requestedEffort,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
    status: extraction.succeeded ? "succeeded" : "failed",
    stopReason: extraction.stopReason,
    usage: normalizeProviderUsage(provider, response.usage ?? {}),
    turns: 1,
    toolCallCount: extraction.tools.length,
    retryCount: 0,
    fallbackUsed: false,
    handoffUsed: false,
    providerMetadata: {
      responseId: response.id,
      responseType: response.type,
      responseStatus: response.status,
      nativeStopReason: response.stop_reason,
      compilationHash: request.compilationHash,
    },
  });
  return { providerRun, outputText: extraction.outputText, toolEvidence: extraction.tools };
}
