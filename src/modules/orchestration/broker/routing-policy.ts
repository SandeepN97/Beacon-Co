import type { ProviderId, ProviderScore, ProviderState, RoutingRequest } from "../domain/provider";
import { isProviderAvailable } from "./provider-health";

export interface RoutingPolicyConfig {
  claudeFirst: boolean;
  codeAffinityProvider: ProviderId;
}

export const defaultRoutingPolicy: RoutingPolicyConfig = {
  claudeFirst: true,
  codeAffinityProvider: "codex",
};

export function scoreProvider(
  state: ProviderState,
  request: RoutingRequest,
  config: RoutingPolicyConfig = defaultRoutingPolicy,
): ProviderScore {
  const reasons: string[] = [];
  const capability = state.capability;
  const eligible =
    isProviderAvailable(state) &&
    capability.workflows.includes(request.workflowType) &&
    capability.dataClassifications.includes(request.dataClassification) &&
    request.requiredTools.every((tool) => capability.tools.includes(tool)) &&
    !(request.purpose === "review" && request.authorProvider === state.provider);

  if (!eligible) {
    if (!isProviderAvailable(state))
      reasons.push("provider is unhealthy, cooling down, or has no manual capacity");
    if (!capability.workflows.includes(request.workflowType))
      reasons.push("workflow capability is missing");
    if (!capability.dataClassifications.includes(request.dataClassification))
      reasons.push("data policy is not eligible");
    if (!request.requiredTools.every((tool) => capability.tools.includes(tool)))
      reasons.push("required tool capability is missing");
    if (request.purpose === "review" && request.authorProvider === state.provider)
      reasons.push("authoring provider cannot independently review its own output");
    return { provider: state.provider, eligible: false, score: Number.NEGATIVE_INFINITY, reasons };
  }

  let score = 50;
  score += state.manualCapacity * 18;
  score -= state.recentFailures * 5;
  score -= state.activeWorkUnits * 3;
  score -= state.estimatedContextPressure * 8;

  if (request.preferredProvider !== "auto" && request.preferredProvider === state.provider) {
    score += 24;
    reasons.push("explicit or translated provider preference");
  }
  if (
    (request.workflowType === "implementation" || request.workflowType === "review") &&
    state.provider === config.codeAffinityProvider
  ) {
    score += 16;
    reasons.push("measured-policy code and test affinity");
  }
  if (
    ["planning", "architecture", "documentation"].includes(request.workflowType) &&
    config.claudeFirst &&
    state.provider === "claude"
  ) {
    score += 12;
    reasons.push("configured Claude-first preference");
  }
  if (request.repositoryContextProvider === state.provider) {
    score += 7;
    reasons.push("existing repository context advantage");
  }
  if (request.purpose === "review" && request.authorProvider !== state.provider) {
    score += 30;
    reasons.push("independent second voice");
  }
  if (state.health === "degraded") {
    score -= 20;
    reasons.push("degraded health penalty");
  }
  reasons.push(`manual capacity ${state.manualCapacity.toFixed(2)}`);
  return { provider: state.provider, eligible: true, score, reasons };
}
