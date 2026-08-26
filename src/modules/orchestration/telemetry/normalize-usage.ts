import type { ProviderId } from "../domain/provider";
import { NormalizedTokenUsageSchema, type NormalizedTokenUsage } from "../domain/provider-run.ts";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown, label: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value as UnknownRecord;
}

function optionalTokenCount(record: UnknownRecord, key: string): number | null {
  const value = record[key];
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new TypeError(`${key} must be a non-negative integer when present.`);
  }
  return Number(value);
}

function sumRequired(left: number | null, right: number | null): number | null {
  return left === null || right === null ? null : left + right;
}

function sumKnown(values: Array<number | null>): number | null {
  const known = values.filter((value): value is number => value !== null);
  return known.length ? known.reduce((total, value) => total + value, 0) : null;
}

export function normalizeAnthropicUsage(input: unknown): NormalizedTokenUsage {
  const usage = asRecord(input, "Anthropic usage");
  const uncachedInputTokens = optionalTokenCount(usage, "input_tokens");
  const cachedInputTokens = optionalTokenCount(usage, "cache_read_input_tokens");
  const cacheWriteTokens = optionalTokenCount(usage, "cache_creation_input_tokens");
  const outputTokens = optionalTokenCount(usage, "output_tokens");
  // Current Anthropic Messages API usage exposes `usage.thinking_tokens` for
  // extended-thinking token counts; there is no documented `usage.reasoning_tokens`
  // field (M1/N1, PR #83 independent review). Extended thinking counts within
  // `max_tokens`/`output_tokens`, so this is validated below exactly like the
  // reasoningTokens <= outputTokens invariant already enforced for OpenAI.
  const reasoningTokens = optionalTokenCount(usage, "thinking_tokens");
  if (
    uncachedInputTokens === null &&
    [cachedInputTokens, cacheWriteTokens, outputTokens, reasoningTokens].some(
      (value) => value !== null,
    )
  ) {
    throw new TypeError("input_tokens is required when Anthropic usage contains token details.");
  }
  const totalInputTokens = sumKnown([uncachedInputTokens, cachedInputTokens, cacheWriteTokens]);
  const totalTokens = sumRequired(totalInputTokens, outputTokens);
  if (reasoningTokens !== null && outputTokens !== null && reasoningTokens > outputTokens) {
    throw new TypeError("reasoning_tokens cannot exceed output_tokens.");
  }

  return NormalizedTokenUsageSchema.parse({
    totalInputTokens,
    cachedInputTokens,
    cacheWriteTokens,
    uncachedInputTokens,
    outputTokens,
    reasoningTokens,
    totalTokens,
  });
}

export function normalizeOpenAIUsage(input: unknown): NormalizedTokenUsage {
  const usage = asRecord(input, "OpenAI usage");
  const totalInputTokens = optionalTokenCount(usage, "input_tokens");
  const outputTokens = optionalTokenCount(usage, "output_tokens");
  const providerTotalTokens = optionalTokenCount(usage, "total_tokens");
  const inputDetails =
    usage.input_tokens_details === undefined || usage.input_tokens_details === null
      ? {}
      : asRecord(usage.input_tokens_details, "input_tokens_details");
  const outputDetails =
    usage.output_tokens_details === undefined || usage.output_tokens_details === null
      ? {}
      : asRecord(usage.output_tokens_details, "output_tokens_details");
  const cachedInputTokens = optionalTokenCount(inputDetails, "cached_tokens");
  // OpenAI Responses usage documents input_tokens_details.cache_write_tokens
  // alongside cached_tokens; the previous normalization always returned null
  // here regardless of what the provider reported (N1, PR #83 independent review).
  const cacheWriteTokens = optionalTokenCount(inputDetails, "cache_write_tokens");
  const reasoningTokens = optionalTokenCount(outputDetails, "reasoning_tokens");

  if (
    totalInputTokens === null &&
    [cachedInputTokens, outputTokens, reasoningTokens, providerTotalTokens].some(
      (value) => value !== null,
    )
  ) {
    throw new TypeError("input_tokens is required when OpenAI usage contains token details.");
  }

  if (
    totalInputTokens !== null &&
    cachedInputTokens !== null &&
    cachedInputTokens > totalInputTokens
  ) {
    throw new TypeError("cached_tokens cannot exceed input_tokens.");
  }
  if (
    totalInputTokens !== null &&
    cacheWriteTokens !== null &&
    (cachedInputTokens ?? 0) + cacheWriteTokens > totalInputTokens
  ) {
    throw new TypeError("cached_tokens plus cache_write_tokens cannot exceed input_tokens.");
  }
  if (reasoningTokens !== null && outputTokens !== null && reasoningTokens > outputTokens) {
    throw new TypeError("reasoning_tokens cannot exceed output_tokens.");
  }

  const uncachedInputTokens =
    totalInputTokens === null
      ? null
      : totalInputTokens -
        (cachedInputTokens === null ? 0 : cachedInputTokens) -
        (cacheWriteTokens === null ? 0 : cacheWriteTokens);
  const calculatedTotalTokens = sumRequired(totalInputTokens, outputTokens);
  if (
    providerTotalTokens !== null &&
    calculatedTotalTokens !== null &&
    providerTotalTokens !== calculatedTotalTokens
  ) {
    throw new TypeError("total_tokens must equal input_tokens plus output_tokens.");
  }

  return NormalizedTokenUsageSchema.parse({
    totalInputTokens,
    cachedInputTokens,
    cacheWriteTokens,
    uncachedInputTokens,
    outputTokens,
    reasoningTokens,
    totalTokens: providerTotalTokens ?? calculatedTotalTokens,
  });
}

export function normalizeProviderUsage(provider: ProviderId, input: unknown): NormalizedTokenUsage {
  return provider === "claude" ? normalizeAnthropicUsage(input) : normalizeOpenAIUsage(input);
}

/**
 * M2 fix (independent security review of PR #83, candidate
 * e895f60e72f912221b7bf9d001d8aa49bdd993eb): sums NormalizedTokenUsage across
 * every ProviderRun that belongs to one AgentRun. Used so `AgentRun.context.usage`
 * is a truthful execution-total whenever `providerRunIds.length > 1` (a retry, a
 * provider switch, or any other multi-ProviderRun AgentRun), instead of silently
 * reporting only the most recently completed ProviderRun's usage while
 * `execution.turns`/`providerRunIds` already claim the full aggregate.
 *
 * A field is null in the result if it is null for ANY input usage: reporting an
 * unknown total as null is safer than a number that silently omits a component
 * Beacon could not observe.
 */
export function aggregateNormalizedTokenUsage(
  usages: readonly NormalizedTokenUsage[],
): NormalizedTokenUsage {
  if (usages.length === 0) {
    return NormalizedTokenUsageSchema.parse({
      totalInputTokens: null,
      cachedInputTokens: null,
      cacheWriteTokens: null,
      uncachedInputTokens: null,
      outputTokens: null,
      reasoningTokens: null,
      totalTokens: null,
    });
  }
  const field = (key: keyof NormalizedTokenUsage): number | null =>
    usages.some((usage) => usage[key] === null)
      ? null
      : usages.reduce((total, usage) => total + (usage[key] as number), 0);
  return NormalizedTokenUsageSchema.parse({
    totalInputTokens: field("totalInputTokens"),
    cachedInputTokens: field("cachedInputTokens"),
    cacheWriteTokens: field("cacheWriteTokens"),
    uncachedInputTokens: field("uncachedInputTokens"),
    outputTokens: field("outputTokens"),
    reasoningTokens: field("reasoningTokens"),
    totalTokens: field("totalTokens"),
  });
}
