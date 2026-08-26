import type { ProviderId } from "../domain/provider.ts";
import { ProviderExecutionError, type ProviderTransport } from "./provider-adapter.ts";

/**
 * B3 rereview fix (independent rereview of PR #83, candidate
 * 225384030a4a30d66c946bdbc0d577a057a8a0c6): the previous correction shared a
 * single `certifyTransportInstance` export across transport files. Exporting
 * the WeakSet-populating function at all let any code call it directly on a
 * hand-built object, and (combined with `Object.setPrototypeOf`) a reviewer
 * confirmed a fully forged transport could reach live invocation.
 *
 * This WeakSet, and the only code that ever calls `.add()` on it (this
 * file's own constructor), are both private to this module -- there is no
 * export, anywhere, capable of adding to it. `isTrustedHttpProviderTransport`
 * is safe to export: checking membership cannot be used to forge membership.
 */
const certifiedHttpProviderTransports = new WeakSet<object>();

export function isTrustedHttpProviderTransport(
  transport: unknown,
): transport is HttpProviderTransport {
  return (
    typeof transport === "object" &&
    transport !== null &&
    Object.getPrototypeOf(transport) === HttpProviderTransport.prototype &&
    certifiedHttpProviderTransports.has(transport)
  );
}

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
    // Only this real constructor ever runs this line; there is no exported
    // way for other code to add itself to certifiedHttpProviderTransports.
    certifiedHttpProviderTransports.add(this);
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
