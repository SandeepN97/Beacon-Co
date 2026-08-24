import { describe, expect, it } from "vitest";
import {
  BothProvidersUnavailableEventSchema,
  CapacityReadingSchema,
  CapacityThresholdsSchema,
  DEFAULT_CAPACITY_THRESHOLDS,
  ProviderCapacityWarningEventSchema,
  ProviderSwitchCompletedEventSchema,
  ProviderSwitchTriggeredEventSchema,
  evaluateCapacityReading,
  initialCapacityWatcherState,
  type CapacityReading,
} from "../../src/modules/orchestration/decision-os/capacity-watcher.ts";

function reading(overrides: Partial<CapacityReading> = {}): CapacityReading {
  return {
    schemaVersion: 1,
    provider: "claude",
    fiveHourUtilization: 0.1,
    sevenDayUtilization: 0.1,
    observedAt: "2026-08-20T14:32:01Z",
    source: "simulated",
    ...overrides,
  };
}

describe("CapacityReadingSchema", () => {
  it("only accepts a simulated source, never a live one", () => {
    expect(() => CapacityReadingSchema.parse(reading({ source: "live" as never }))).toThrow();
    expect(CapacityReadingSchema.parse(reading()).source).toBe("simulated");
  });

  it("rejects utilization outside 0..1", () => {
    expect(() => CapacityReadingSchema.parse(reading({ fiveHourUtilization: 1.5 }))).toThrow();
    expect(() => CapacityReadingSchema.parse(reading({ fiveHourUtilization: -0.1 }))).toThrow();
  });
});

describe("CapacityThresholdsSchema", () => {
  it("accepts the documented defaults", () => {
    expect(CapacityThresholdsSchema.parse(DEFAULT_CAPACITY_THRESHOLDS)).toEqual(
      DEFAULT_CAPACITY_THRESHOLDS,
    );
  });

  it("rejects a warning threshold at or above hardCap", () => {
    expect(() => CapacityThresholdsSchema.parse({ warning: 0.9, hardCap: 0.9 })).toThrow();
    expect(() => CapacityThresholdsSchema.parse({ warning: 0.95, hardCap: 0.9 })).toThrow();
  });
});

describe("evaluateCapacityReading: below warning threshold", () => {
  it("raises no event and stays in-progress", () => {
    const state = initialCapacityWatcherState("claude");
    const result = evaluateCapacityReading(state, reading({ fiveHourUtilization: 0.5 }));
    expect(result.events).toEqual([]);
    expect(result.state.phase).toBe("in-progress");
    expect(result.state.activeProvider).toBe("claude");
  });
});

describe("evaluateCapacityReading: simulated capacity-warning scenario", () => {
  it("raises ProviderCapacityWarning once utilization crosses the warning threshold", () => {
    const state = initialCapacityWatcherState("claude");
    const result = evaluateCapacityReading(state, reading({ fiveHourUtilization: 0.88 }));
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({ type: "ProviderCapacityWarning", provider: "claude" });
    expect(result.state.phase).toBe("in-progress");
    expect(result.state.warnedProviders).toEqual(["claude"]);
  });

  it("does not re-raise the warning on a subsequent reading for the same provider", () => {
    const state = initialCapacityWatcherState("claude");
    const first = evaluateCapacityReading(state, reading({ fiveHourUtilization: 0.88 }));
    const second = evaluateCapacityReading(first.state, reading({ fiveHourUtilization: 0.9 }));
    expect(second.events).toEqual([]);
  });

  it("uses the max of five-hour and seven-day utilization", () => {
    const state = initialCapacityWatcherState("claude");
    const result = evaluateCapacityReading(
      state,
      reading({ fiveHourUtilization: 0.1, sevenDayUtilization: 0.9 }),
    );
    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe("ProviderCapacityWarning");
  });
});

describe("evaluateCapacityReading: simulated hard-cap scenario, automatic switch", () => {
  it("switches to the other provider when the active provider hits hardCap and the other is not capped", () => {
    const state = initialCapacityWatcherState("claude");
    const result = evaluateCapacityReading(state, reading({ fiveHourUtilization: 0.99 }));
    expect(result.events.map((e) => e.type)).toEqual([
      "ProviderSwitchTriggered",
      "ProviderSwitchCompleted",
    ]);
    expect(result.events[0].toProvider).toBe("codex");
    expect(result.events[1].toProvider).toBe("codex");
    expect(result.state.activeProvider).toBe("codex");
    expect(result.state.phase).toBe("switched");
  });

  it("continues watching after a switch: the newly active provider can itself warn or cap later", () => {
    const state = initialCapacityWatcherState("claude");
    const afterSwitch = evaluateCapacityReading(state, reading({ fiveHourUtilization: 0.99 }));
    expect(afterSwitch.state.activeProvider).toBe("codex");

    const afterWarning = evaluateCapacityReading(
      afterSwitch.state,
      reading({ provider: "codex", fiveHourUtilization: 0.88 }),
    );
    expect(afterWarning.events).toHaveLength(1);
    expect(afterWarning.events[0]).toMatchObject({
      type: "ProviderCapacityWarning",
      provider: "codex",
    });
  });
});

describe("evaluateCapacityReading: both-capped terminal pause state", () => {
  it("pauses when the active provider hits hardCap while the other is already known capped", () => {
    const state = initialCapacityWatcherState("claude");
    // codex is observed capped first (not yet the active provider)
    const afterCodexCap = evaluateCapacityReading(
      state,
      reading({ provider: "codex", fiveHourUtilization: 0.99 }),
    );
    expect(afterCodexCap.events).toEqual([]);
    expect(afterCodexCap.state.phase).toBe("in-progress");

    // now claude (still active) also hits hardCap -- both are capped
    const afterBothCap = evaluateCapacityReading(
      afterCodexCap.state,
      reading({ fiveHourUtilization: 0.99 }),
    );
    expect(afterBothCap.events).toHaveLength(1);
    expect(afterBothCap.events[0].type).toBe("BothProvidersUnavailable");
    expect(afterBothCap.state.phase).toBe("paused");
  });

  it("pauses when a switch lands on a provider already known capped", () => {
    const state = initialCapacityWatcherState("claude");
    const afterCodexCap = evaluateCapacityReading(
      state,
      reading({ provider: "codex", fiveHourUtilization: 0.99 }),
    );
    const afterClaudeCap = evaluateCapacityReading(
      afterCodexCap.state,
      reading({ fiveHourUtilization: 0.99 }),
    );
    expect(afterClaudeCap.events).toHaveLength(1);
    expect(afterClaudeCap.events[0].type).toBe("BothProvidersUnavailable");
    expect(afterClaudeCap.state.phase).toBe("paused");
    // no switch was attempted onto the already-capped codex
    expect(afterClaudeCap.events.some((e) => e.type === "ProviderSwitchTriggered")).toBe(false);
  });

  it("pauses when the non-active, already-capped-active-provider case arrives in reverse order", () => {
    const state = initialCapacityWatcherState("claude");
    const afterClaudeCap = evaluateCapacityReading(state, reading({ fiveHourUtilization: 0.99 }));
    expect(afterClaudeCap.state.phase).toBe("switched");
    expect(afterClaudeCap.state.activeProvider).toBe("codex");

    const afterCodexCap = evaluateCapacityReading(
      afterClaudeCap.state,
      reading({ provider: "codex", fiveHourUtilization: 0.99 }),
    );
    expect(afterCodexCap.events).toHaveLength(1);
    expect(afterCodexCap.events[0].type).toBe("BothProvidersUnavailable");
    expect(afterCodexCap.state.phase).toBe("paused");
  });

  it("is a true terminal state: no further events once paused, no unattended polling implied", () => {
    const state = initialCapacityWatcherState("claude");
    const afterCodexCap = evaluateCapacityReading(
      state,
      reading({ provider: "codex", fiveHourUtilization: 0.99 }),
    );
    const paused = evaluateCapacityReading(
      afterCodexCap.state,
      reading({ fiveHourUtilization: 0.99 }),
    );
    expect(paused.state.phase).toBe("paused");

    const afterPause = evaluateCapacityReading(paused.state, reading({ fiveHourUtilization: 0.1 }));
    expect(afterPause.events).toEqual([]);
    expect(afterPause.state.phase).toBe("paused");
    expect(afterPause.state).toEqual(paused.state);
  });
});

describe("evaluateCapacityReading: threshold logic unit tests", () => {
  it("respects custom thresholds instead of only the defaults", () => {
    const state = initialCapacityWatcherState("claude");
    const tightThresholds = { warning: 0.5, hardCap: 0.6 };
    const result = evaluateCapacityReading(
      state,
      reading({ fiveHourUtilization: 0.55 }),
      tightThresholds,
    );
    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe("ProviderCapacityWarning");
  });

  it("treats a reading exactly at the threshold as crossing it", () => {
    const state = initialCapacityWatcherState("claude");
    const result = evaluateCapacityReading(
      state,
      reading({ fiveHourUtilization: DEFAULT_CAPACITY_THRESHOLDS.warning }),
    );
    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe("ProviderCapacityWarning");
  });

  it("rejects malformed thresholds via the schema rather than misbehaving silently", () => {
    const state = initialCapacityWatcherState("claude");
    expect(() =>
      evaluateCapacityReading(state, reading({ fiveHourUtilization: 0.9 }), {
        warning: 0.9,
        hardCap: 0.9,
      }),
    ).toThrow();
  });
});

describe("provider-continuity event payload schemas", () => {
  const envelopeBase = {
    schemaVersion: 1 as const,
    eventId: "event-1",
    occurredAt: "2026-08-20T14:32:01.000Z",
    actorRef: "capacity-watcher",
    projectRef: "beacon-co",
    aggregateRef: "provider-claude",
    projectContextRef: null,
    causationRef: null,
    correlationRef: null,
  };

  it("validates a real ProviderCapacityWarning event this watcher would emit", () => {
    const event = ProviderCapacityWarningEventSchema.parse({
      ...envelopeBase,
      eventType: "ProviderCapacityWarning",
      payload: { provider: "claude", fiveHourUtilization: 0.88, sevenDayUtilization: 0.4 },
    });
    expect(event.payload.provider).toBe("claude");
  });

  it("validates a real ProviderSwitchTriggered / ProviderSwitchCompleted pair", () => {
    const triggered = ProviderSwitchTriggeredEventSchema.parse({
      ...envelopeBase,
      eventType: "ProviderSwitchTriggered",
      payload: { fromProvider: "claude", toProvider: "codex", reason: "hard-cap-reached" },
    });
    expect(triggered.payload.toProvider).toBe("codex");

    const completed = ProviderSwitchCompletedEventSchema.parse({
      ...envelopeBase,
      eventType: "ProviderSwitchCompleted",
      payload: { fromProvider: "claude", toProvider: "codex" },
    });
    expect(completed.payload.fromProvider).toBe("claude");
  });

  it("validates a real BothProvidersUnavailable event", () => {
    const event = BothProvidersUnavailableEventSchema.parse({
      ...envelopeBase,
      eventType: "BothProvidersUnavailable",
      payload: { claudeUtilization: 0.99, codexUtilization: 0.98 },
    });
    expect(event.payload.claudeUtilization).toBeGreaterThan(0.9);
  });

  it("rejects a switch-triggered payload with an unrecognized reason", () => {
    expect(() =>
      ProviderSwitchTriggeredEventSchema.parse({
        ...envelopeBase,
        eventType: "ProviderSwitchTriggered",
        payload: { fromProvider: "claude", toProvider: "codex", reason: "manual" },
      }),
    ).toThrow();
  });
});
