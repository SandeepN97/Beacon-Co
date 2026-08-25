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
  const reasoningTokens = optionalTokenCount(usage, "reasoning_tokens");
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
  if (reasoningTokens !== null && outputTokens !== null && reasoningTokens > outputTokens) {
    throw new TypeError("reasoning_tokens cannot exceed output_tokens.");
  }

  const uncachedInputTokens =
    totalInputTokens === null
      ? null
      : totalInputTokens - (cachedInputTokens === null ? 0 : cachedInputTokens);
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
    cacheWriteTokens: null,
    uncachedInputTokens,
    outputTokens,
    reasoningTokens,
    totalTokens: providerTotalTokens ?? calculatedTotalTokens,
  });
}

export function normalizeProviderUsage(provider: ProviderId, input: unknown): NormalizedTokenUsage {
  return provider === "claude" ? normalizeAnthropicUsage(input) : normalizeOpenAIUsage(input);
}
