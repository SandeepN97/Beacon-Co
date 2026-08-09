import type { ProviderId } from "../domain/provider.ts";
import type { ProviderRun } from "../domain/provider-run.ts";
import type { WorkRequest } from "../domain/work-request.ts";
import type { RetrievedContextPackage } from "../knowledge/context-packager.ts";

export interface ProviderPrompt {
  provider: ProviderId;
  requestId: string;
  content: string;
  simulated: true;
}

export interface SimulatedProviderResult {
  provider: ProviderId;
  status: "simulated-complete";
  prompt: ProviderPrompt;
  message: string;
  liveInvocation: false;
}

export interface SimulatedProviderAdapter {
  readonly provider: ProviderId;
  compile(request: WorkRequest, context: RetrievedContextPackage): ProviderPrompt;
  simulate(request: WorkRequest, context: RetrievedContextPackage): SimulatedProviderResult;
}

export interface ProviderAdapter extends SimulatedProviderAdapter {
  execute(request: ProviderExecutionRequest): Promise<ProviderExecutionResult>;
}

export interface ProviderExecutionRequest {
  providerRunId: string;
  agentRunId: string;
  workUnitId: string;
  taskFingerprint: string;
  prompt: string;
  compilationHash: string;
  resolvedModelId: string;
  requestedEffort: string | null;
  maxOutputTokens: number;
  maxTurns: number;
}

export interface ProviderExecutionResult {
  providerRun: ProviderRun;
  outputText: string;
  toolEvidence: Array<{
    toolCallId: string;
    toolName: string;
    inputFingerprint: string;
  }>;
}

export interface ProviderTransport {
  invoke(provider: ProviderId, payload: Record<string, unknown>): Promise<Record<string, unknown>>;
}

export class ProviderExecutionError extends Error {
  readonly provider: ProviderId;
  readonly category:
    "capacity" | "transient" | "authentication" | "policy" | "invalid-response" | "unknown";
  readonly retryable: boolean;
  readonly statusCode: number | null;

  constructor(
    provider: ProviderId,
    category:
      "capacity" | "transient" | "authentication" | "policy" | "invalid-response" | "unknown",
    message: string,
    retryable: boolean,
    statusCode: number | null = null,
  ) {
    super(message);
    this.name = "ProviderExecutionError";
    this.provider = provider;
    this.category = category;
    this.retryable = retryable;
    this.statusCode = statusCode;
  }
}
