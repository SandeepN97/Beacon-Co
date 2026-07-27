import type { ProviderHealth, ProviderId, ProviderState } from "../domain/provider";
import { createProviderState } from "./provider-health";

export class CapacityManager {
  private readonly states = new Map<ProviderId, ProviderState>();

  constructor(initial?: Partial<Record<ProviderId, Partial<ProviderState>>>) {
    for (const provider of ["claude", "codex"] as const) {
      this.states.set(provider, {
        ...createProviderState(provider),
        ...initial?.[provider],
        provider,
      });
    }
  }

  get(provider: ProviderId): ProviderState {
    const state = this.states.get(provider);
    if (!state) throw new Error(`Unknown provider: ${provider}`);
    return { ...state, capability: { ...state.capability } };
  }

  list(): ProviderState[] {
    return [...this.states.keys()].map((provider) => this.get(provider));
  }

  setManualCapacity(provider: ProviderId, value: number): ProviderState {
    if (value < 0 || value > 1) throw new Error("Manual capacity must be between 0 and 1.");
    return this.update(provider, { manualCapacity: value });
  }

  setHealth(
    provider: ProviderId,
    health: ProviderHealth,
    cooldownUntil: string | null = null,
  ): ProviderState {
    return this.update(provider, { health, cooldownUntil });
  }

  recordFailure(provider: ProviderId, cooldownMinutes = 15): ProviderState {
    const current = this.get(provider);
    const cooldownUntil = new Date(Date.now() + cooldownMinutes * 60_000).toISOString();
    return this.update(provider, {
      recentFailures: current.recentFailures + 1,
      health: "degraded",
      cooldownUntil,
    });
  }

  recordSuccess(provider: ProviderId): ProviderState {
    return this.update(provider, {
      recentFailures: 0,
      health: "healthy",
      cooldownUntil: null,
      lastSuccessfulRun: new Date().toISOString(),
    });
  }

  private update(provider: ProviderId, changes: Partial<ProviderState>): ProviderState {
    const next = { ...this.get(provider), ...changes, provider };
    this.states.set(provider, next);
    return this.get(provider);
  }
}
