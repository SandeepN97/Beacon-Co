import type { ProviderId } from "../domain/provider";
import type { WorkRequest } from "../domain/work-request";
import type { ContextPackage } from "../knowledge/context-packager";

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

export interface ProviderAdapter {
  readonly provider: ProviderId;
  compile(request: WorkRequest, context: ContextPackage): ProviderPrompt;
  simulate(request: WorkRequest, context: ContextPackage): SimulatedProviderResult;
}
