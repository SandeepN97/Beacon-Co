import type { ProviderId } from "../domain/provider.ts";
import { ProviderExecutionError, type ProviderTransport } from "./provider-adapter.ts";

export interface ProviderCredentials {
  anthropicApiKey?: string;
  openaiApiKey?: string;
}

function classifyHttpError(provider: ProviderId, status: number): ProviderExecutionError {
  if (status === 401 || status === 403) {
    return new ProviderExecutionError(
      provider,
      "authentication",
      "Provider authentication failed.",
      false,
      status,
    );
  }
  if (status === 429) {
    return new ProviderExecutionError(
      provider,
      "capacity",
      "Provider capacity or rate limit was reached.",
      true,
      status,
    );
  }
  if (status >= 500) {
    return new ProviderExecutionError(
      provider,
      "transient",
      "Provider returned a transient server error.",
      true,
      status,
    );
  }
  return new ProviderExecutionError(
    provider,
    "policy",
    "Provider rejected the bounded request.",
    false,
    status,
  );
}

export class HttpProviderTransport implements ProviderTransport {
  private readonly credentials: ProviderCredentials;
  private readonly fetchImplementation: typeof fetch;

  constructor(credentials: ProviderCredentials, fetchImplementation: typeof fetch = fetch) {
    this.credentials = credentials;
    this.fetchImplementation = fetchImplementation;
  }

  executionBudgetContract(provider: ProviderId) {
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

  validateBeforeInvocation(provider: ProviderId): void {
    const apiKey =
      provider === "claude" ? this.credentials.anthropicApiKey : this.credentials.openaiApiKey;
    if (!apiKey) {
      throw new ProviderExecutionError(
        provider,
        "authentication",
        "Provider credential is unavailable.",
        false,
      );
    }
  }

  async invoke(
    provider: ProviderId,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const isClaude = provider === "claude";
    const apiKey = isClaude ? this.credentials.anthropicApiKey : this.credentials.openaiApiKey;
    this.validateBeforeInvocation(provider);
    if (!apiKey) {
      throw new ProviderExecutionError(
        provider,
        "authentication",
        "Provider credential is unavailable.",
        false,
      );
    }
    let response: Response;
    try {
      response = await this.fetchImplementation(
        isClaude ? "https://api.anthropic.com/v1/messages" : "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: isClaude
            ? {
                "content-type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
              }
            : { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(payload),
        },
      );
    } catch {
      throw new ProviderExecutionError(
        provider,
        "transient",
        "Provider network request failed.",
        true,
      );
    }
    if (!response.ok) throw classifyHttpError(provider, response.status);
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new ProviderExecutionError(
        provider,
        "invalid-response",
        "Provider returned a non-object response.",
        false,
      );
    }
    return body as Record<string, unknown>;
  }
}
