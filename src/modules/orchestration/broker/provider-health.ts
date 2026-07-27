import type { ProviderState } from "../domain/provider";

const allWorkflows = [
  "documentation",
  "planning",
  "architecture",
  "implementation",
  "review",
  "operations",
  "mixed",
] as const;

export function createProviderState(provider: ProviderState["provider"]): ProviderState {
  return {
    provider,
    health: "healthy",
    cooldownUntil: null,
    manualCapacity: 1,
    recentFailures: 0,
    activeWorkUnits: 0,
    estimatedContextPressure: 0,
    lastSuccessfulRun: null,
    capability: {
      workflows: [...allWorkflows],
      tools: ["repository-read", "structured-output", "prompt-preview", "simulation"],
      dataClassifications: ["public", "internal", "confidential"],
    },
  };
}

export function isProviderAvailable(state: ProviderState, now = new Date()): boolean {
  if (state.health === "unavailable" || state.health === "rate-limited") return false;
  if (state.manualCapacity <= 0) return false;
  if (state.cooldownUntil && new Date(state.cooldownUntil) > now) return false;
  return true;
}
