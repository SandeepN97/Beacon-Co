import { createHash } from "node:crypto";
import type { ProviderId } from "../domain/provider.ts";
import type { NormalizedTokenUsage, ProviderRun } from "../domain/provider-run.ts";
import {
  ExecutionBudgetAdmissionError,
  ExecutionBudgetEvidencePersistenceError,
  ExecutionBudgetPoisonedError,
  ExecutionBudgetStateError,
  ExecutionBudgetWriterFenceError,
  resolveProviderModelCallLimit,
  type ExecutionBudgetReservation,
} from "../execution-budget/execution-budget.ts";
import { isCertifiedTransportInstance } from "../execution-budget/trusted-transport.ts";
import { normalizeProviderUsage } from "../telemetry/normalize-usage.ts";
import { prepareProviderRun } from "../telemetry/redaction.ts";
import { CodexCliTransport } from "./codex/codex-cli-transport.ts";
import { HttpProviderTransport } from "./http-provider-transport.ts";
import {
  ProviderExecutionError,
  type ProviderExecutionRequest,
  type ProviderExecutionResult,
  type ProviderTransport,
} from "./provider-adapter.ts";

/**
 * Fixes B3 (independent security review of PR #83, candidate
 * e895f60e72f912221b7bf9d001d8aa49bdd993eb): live provider execution may only
 * cross into `transport.invoke()` for an exact, certified concrete transport
 * class. `instanceof` alone is rejected here because a subclass could override
 * `invoke`/`executionBudgetContract` while still passing it; requiring the
 * *exact* prototype additionally rejects that. `isCertifiedTransportInstance`
 * additionally rejects an object that fakes the prototype via
 * `Object.setPrototypeOf`/`Object.create` without running the real
 * constructor. Neither check alone is sufficient; both are required.
 */
function isTrustedLiveProviderTransport(transport: ProviderTransport): boolean {
  const proto: unknown = Object.getPrototypeOf(transport);
  const isKnownConcreteTransport =
    proto === HttpProviderTransport.prototype || proto === CodexCliTransport.prototype;
  return isKnownConcreteTransport && isCertifiedTransportInstance(transport);
}

type StopReason = Exclude<ProviderRun["stopReason"], null>;

interface ExtractedProviderResult {
  outputText: string;
  tools: Array<{ toolCallId: string; toolName: string; inputFingerprint: string }>;
  stopReason: StopReason;
  succeeded: boolean;
}

function record(provider: ProviderId, value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProviderExecutionError(
      provider,
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
      record("claude", block, "Claude content block").type === "text"
        ? stringValue(record("claude", block, "Claude content block").text)
        : null,
    )
    .filter((value): value is string => value !== null)
    .join("\n");
  const tools = blocks
    .map((block) => record("claude", block, "Claude content block"))
    .filter((block) => block.type === "tool_use")
    .map((block) => ({
      toolCallId: stringValue(block.id) ?? "unknown-tool-call",
      toolName: stringValue(block.name) ?? "unknown-tool",
      inputFingerprint: createHash("sha256")
        .update(JSON.stringify(block.input ?? {}))
        .digest("hex"),
    }));
  const stopReason = mapClaudeStopReason(stringValue(response.stop_reason));
  return { outputText, tools, stopReason, succeeded: stopReason === "completed" };
}

/**
 * Fixes N3 (independent security review of PR #83, candidate
 * e895f60e72f912221b7bf9d001d8aa49bdd993eb): the previous mapping treated any
 * `stop_reason` other than "max_tokens"/"tool_use" as normal completion, which
 * silently turned an unrecognized or future Anthropic stop reason into
 * `"completed"`. Every currently documented Anthropic stop reason is handled
 * explicitly; only `end_turn` and `stop_sequence` are genuine normal
 * completions. Anything not on this list -- including a value Anthropic adds
 * later -- fails closed to `"unknown"` rather than defaulting to success.
 */
function mapClaudeStopReason(nativeStop: string | null): StopReason {
  switch (nativeStop) {
    case "end_turn":
    case "stop_sequence":
      return "completed";
    case "max_tokens":
      return "output-token-budget-exhausted";
    case "tool_use":
    case "pause_turn":
    case "refusal":
      return "blocked";
    case "model_context_window_exceeded":
      return "provider-error";
    default:
      return "unknown";
  }
}

export function extractCodexResult(response: Record<string, unknown>): ExtractedProviderResult {
  const output = Array.isArray(response.output) ? response.output : [];
  const outputText = output
    .flatMap((item) => {
      const entry = record("codex", item, "OpenAI output item");
      const content = Array.isArray(entry.content) ? entry.content : [];
      return content.map((part) => {
        const value = record("codex", part, "OpenAI output content");
        return value.type === "output_text" ? stringValue(value.text) : null;
      });
    })
    .filter((value): value is string => value !== null)
    .join("\n");
  const tools = output
    .map((item) => record("codex", item, "OpenAI output item"))
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
        ? "output-token-budget-exhausted"
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
  usage: NormalizedTokenUsage;
  reservation: ExecutionBudgetReservation;
}): ProviderExecutionResult {
  const { provider, request, response, extraction, usage, reservation, startedAt, completedAt } =
    options;
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
    usage,
    turns: request.budgetLedger.projectProviderRun(request.providerRunId).modelCallsInitiated,
    toolCallCount: extraction.tools.length,
    retryCount: request.budgetLedger.projectProviderRun(request.providerRunId).retryCount,
    fallbackUsed: request.modelCallKind === "fallback" || request.providerTransitionFrom != null,
    handoffUsed: request.modelCallKind === "handoff" || request.handoffFrom != null,
    providerMetadata: {
      responseId: response.id,
      responseType: response.type,
      responseStatus: response.status,
      nativeStopReason: response.stop_reason,
      compilationHash: request.compilationHash,
      executionBudget: {
        budgetLineageId: request.budgetLineageId,
        budgetReservationId: reservation.budgetReservationId,
        maxModelCalls: request.maxModelCalls,
        maxOutputTokens: request.maxOutputTokens,
        outputTokenAllowance: reservation.outputTokenAllowance,
        observedOutputTokens: reservation.observedOutputTokens,
        policyChargedOutputTokens: reservation.policyChargedOutputTokens,
        reservationState: reservation.state,
        enforcementOwner: reservation.enforcementOwner,
      },
    },
  });
  return { providerRun, outputText: extraction.outputText, toolEvidence: extraction.tools };
}

function rawOutputTokens(usage: unknown): number | null {
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) return null;
  const value = (usage as Record<string, unknown>).output_tokens;
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : null;
}

function hasUnsupportedUsageUnit(usage: unknown): boolean {
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) return false;
  const unit = (usage as Record<string, unknown>).unit;
  return unit !== undefined && unit !== "tokens";
}

function asProviderExecutionError(provider: ProviderId, error: unknown): ProviderExecutionError {
  if (error instanceof ProviderExecutionError) return error;
  if (error instanceof ExecutionBudgetAdmissionError) {
    const stopReason =
      error.reason === "MODEL_CALL_BUDGET_EXHAUSTED"
        ? "model-call-budget-exhausted"
        : error.reason === "OUTPUT_TOKEN_BUDGET_EXHAUSTED"
          ? "output-token-budget-exhausted"
          : "budget-exceeded";
    return new ProviderExecutionError(provider, "policy", error.message, false, null, stopReason);
  }
  if (
    error instanceof ExecutionBudgetStateError ||
    error instanceof ExecutionBudgetEvidencePersistenceError ||
    error instanceof ExecutionBudgetPoisonedError ||
    error instanceof ExecutionBudgetWriterFenceError
  ) {
    return new ProviderExecutionError(
      provider,
      "policy",
      "Requested provider execution budgets cannot be enforced.",
      false,
    );
  }
  return new ProviderExecutionError(provider, "unknown", "Provider execution failed.", false);
}

export async function executeBudgetedProviderCall(options: {
  provider: ProviderId;
  request: ProviderExecutionRequest;
  transport: ProviderTransport;
  startedAt: Date;
  now: () => Date;
  payload: (outputTokenAllowance: number) => Record<string, unknown>;
  extract: (response: Record<string, unknown>) => ExtractedProviderResult;
}): Promise<ProviderExecutionResult> {
  const { provider, request, transport, startedAt, now } = options;
  let maxModelCalls: number;
  try {
    maxModelCalls = resolveProviderModelCallLimit({
      maxModelCalls: request.maxModelCalls,
      legacyMaxTurns: request.maxTurns,
    });
  } catch (error) {
    throw asProviderExecutionError(provider, error);
  }
  const lineage = request.budgetLedger.lineage;
  if (
    request.budgetLineageId !== request.budgetLedger.budgetLineageId ||
    lineage.workUnitId !== request.workUnitId ||
    lineage.maxModelCalls !== maxModelCalls ||
    lineage.maxOutputTokens !== request.maxOutputTokens
  ) {
    throw new ProviderExecutionError(
      provider,
      "policy",
      "Provider request budget fields do not match the authorized execution lineage.",
      false,
    );
  }
  if (request.budgetLedger.evidenceDurability !== "fsync-journal") {
    throw new ProviderExecutionError(
      provider,
      "policy",
      "Live provider execution requires a crash-recoverable execution-budget journal.",
      false,
    );
  }
  if (!isTrustedLiveProviderTransport(transport)) {
    throw new ProviderExecutionError(
      provider,
      "policy",
      "Live provider execution requires an exact, certified transport implementation; " +
        "an arbitrary ProviderTransport cannot self-certify into the live execution boundary.",
      false,
    );
  }
  const contract = transport.executionBudgetContract(provider);
  if (
    contract.kind !== "single-generation" ||
    contract.generationBranchesPerInvoke !== 1 ||
    contract.automaticRetries !== false ||
    contract.authoritativeTerminalUsage !== true ||
    contract.streaming !== false ||
    contract.hardOutputTokenCap !==
      (provider === "claude" ? "anthropic-max-tokens" : "openai-max-output-tokens")
  ) {
    throw new ProviderExecutionError(
      provider,
      "policy",
      "Requested provider execution budgets cannot be enforced.",
      false,
    );
  }
  try {
    await transport.validateBeforeInvocation?.(provider);
  } catch (error) {
    throw asProviderExecutionError(provider, error);
  }
  const remainingOutputTokens = request.budgetLedger.snapshot().outputTokensRemaining;
  const requestedOutputTokenAllowance = Math.min(
    request.maxOutputTokens,
    Math.max(1, remainingOutputTokens),
  );
  let reservation: ExecutionBudgetReservation;
  try {
    reservation = await request.budgetLedger.admitModelCall({
      providerRunId: request.providerRunId,
      agentRunId: request.agentRunId,
      provider,
      resolvedModelId: request.resolvedModelId,
      kind: request.modelCallKind,
      requestedOutputTokenAllowance,
      providerHardCap: requestedOutputTokenAllowance,
      enforcementOwner: `${provider}-direct-http-adapter`,
      providerTransitionFrom: request.providerTransitionFrom ?? null,
      handoffFrom: request.handoffFrom ?? null,
    });
  } catch (error) {
    throw asProviderExecutionError(provider, error);
  }

  let payload: Record<string, unknown>;
  try {
    payload = options.payload(reservation.outputTokenAllowance);
  } catch (error) {
    try {
      await request.budgetLedger.cancelBeforeInvocation(
        reservation.budgetReservationId,
        "local-payload-construction-failed-before-invocation",
      );
    } catch (cancellationError) {
      throw asProviderExecutionError(provider, cancellationError);
    }
    throw asProviderExecutionError(provider, error);
  }
  try {
    await request.budgetLedger.markInvoked(reservation.budgetReservationId);
  } catch (error) {
    throw asProviderExecutionError(provider, error);
  }

  // B1/B4/B5 fix (independent security review of PR #83, candidate
  // e895f60e72f912221b7bf9d001d8aa49bdd993eb): re-validate this process's
  // writer-lease fence immediately before the irreversible step. Durable
  // INVOKED evidence above proves *intent* to invoke; this proves *this
  // process* is still the lineage's authoritative writer at the instant of
  // invocation, closing the window where a suspended/stale process wakes up
  // after another process has safely taken over the lineage.
  try {
    await request.budgetLedger.assertWriterAuthority();
  } catch (error) {
    throw asProviderExecutionError(provider, error);
  }

  let response: Record<string, unknown>;
  try {
    response = await transport.invoke(provider, payload);
  } catch (error) {
    try {
      await request.budgetLedger.settleConservative(
        reservation.budgetReservationId,
        null,
        "provider-invocation-error-or-uncertainty",
      );
    } catch (settlementError) {
      throw asProviderExecutionError(provider, settlementError);
    }
    throw asProviderExecutionError(provider, error);
  }

  try {
    let usage: NormalizedTokenUsage;
    try {
      if (hasUnsupportedUsageUnit(response.usage)) {
        throw new TypeError("Provider usage reported an unsupported unit.");
      }
      usage = normalizeProviderUsage(provider, response.usage ?? {});
    } catch {
      const observed = hasUnsupportedUsageUnit(response.usage)
        ? null
        : rawOutputTokens(response.usage);
      await request.budgetLedger.settleConservative(
        reservation.budgetReservationId,
        observed,
        "invalid-terminal-provider-usage",
      );
      if (request.budgetLedger.snapshot().violation) {
        throw new ProviderExecutionError(
          provider,
          "policy",
          "Provider usage breached the admitted hard output-token cap.",
          false,
        );
      }
      throw new ProviderExecutionError(
        provider,
        "invalid-response",
        "Provider returned invalid terminal usage.",
        false,
      );
    }
    if (usage.outputTokens === null) {
      await request.budgetLedger.settleConservative(
        reservation.budgetReservationId,
        null,
        "missing-authoritative-terminal-usage",
      );
      throw new ProviderExecutionError(
        provider,
        "invalid-response",
        "Provider response omitted authoritative output usage.",
        false,
      );
    }
    const settlementState = await request.budgetLedger.settleAuthoritative(
      reservation.budgetReservationId,
      usage.outputTokens,
    );
    if (settlementState === "VIOLATION") {
      throw new ProviderExecutionError(
        provider,
        "policy",
        "Provider usage breached the admitted hard output-token cap.",
        false,
      );
    }
    const settledReservation = request.budgetLedger
      .snapshot()
      .reservations.find(
        (candidate) => candidate.budgetReservationId === reservation.budgetReservationId,
      );
    if (!settledReservation) {
      throw new ProviderExecutionError(
        provider,
        "policy",
        "Execution-budget settlement evidence is unavailable.",
        false,
      );
    }
    const extraction = options.extract(response);
    return buildProviderResult({
      provider,
      request,
      response,
      startedAt,
      completedAt: now(),
      extraction,
      usage,
      reservation: settledReservation,
    });
  } catch (error) {
    throw asProviderExecutionError(provider, error);
  }
}
