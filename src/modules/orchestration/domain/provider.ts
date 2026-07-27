import type { DataClassification, ProviderPreference, WorkflowType } from "./work-request";

export type ProviderId = "claude" | "codex";
export type ProviderHealth = "healthy" | "degraded" | "rate-limited" | "unavailable";

export interface ProviderCapability {
  workflows: WorkflowType[];
  tools: string[];
  dataClassifications: DataClassification[];
}

export interface ProviderState {
  provider: ProviderId;
  health: ProviderHealth;
  cooldownUntil: string | null;
  manualCapacity: number;
  recentFailures: number;
  activeWorkUnits: number;
  estimatedContextPressure: number;
  lastSuccessfulRun: string | null;
  capability: ProviderCapability;
}

export interface RoutingRequest {
  workflowType: WorkflowType;
  dataClassification: DataClassification;
  preferredProvider: ProviderPreference;
  requiredTools: string[];
  authorProvider?: ProviderId;
  authorSessionId?: string;
  purpose?: "primary" | "review";
  repositoryContextProvider?: ProviderId;
}

export interface ProviderScore {
  provider: ProviderId;
  eligible: boolean;
  score: number;
  reasons: string[];
}

export interface RoutingDecision {
  provider: ProviderId | null;
  reason: string;
  scores: ProviderScore[];
  fallbackUsed: boolean;
}
