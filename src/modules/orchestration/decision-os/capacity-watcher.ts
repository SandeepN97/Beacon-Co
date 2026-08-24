import { z } from "astro/zod";
import type { ProviderId } from "../domain/provider.ts";
import { KnowledgeEventSchema } from "./events.ts";

/**
 * Section 29A.3's Capacity Watcher, bounded exactly to ADR-0020's PR-0.5 scope
 * (src/content/docs/decisions/0020-authorize-pr-0-5-and-pr-0-6-as-bounded-increments.mdoc):
 * "design and implementation of predictive usage monitoring, automatic switch
 * trigger, both-capped terminal state, and `beacon` CLI UX for in-progress/
 * switched/paused states -- validated only through simulated capacity-warning
 * and hard-cap scenarios and unit tests for threshold logic ... Live
 * provider-capacity polling against a real production incident is explicitly
 * out of scope for this authorization."
 *
 * That boundary is structural here, not just a convention: `CapacityReading`'s
 * `source` field is the literal `"simulated"` (no `"live"` variant exists in
 * the type at all), and nothing in this file performs network I/O -- readings
 * only ever arrive as a plain value a caller passes in. Wiring a real poller
 * against Claude Code's `/usage`-shaped `five_hour`/`seven_day` utilization
 * fields (Section 29A.7) is a distinct, not-yet-authorized future change.
 *
 * `evaluateCapacityReading` is a pure state-machine step: given the watcher's
 * current state and one new reading, it returns the next state and the events
 * (if any) that reading should raise. It never calls out to anything, so the
 * same simulated-scenario harness that drives the unit tests is the only
 * caller this PR wires up.
 */

export const CapacityReadingSchema = z
  .object({
    schemaVersion: z.literal(1),
    provider: z.enum(["claude", "codex"]),
    fiveHourUtilization: z.number().min(0).max(1),
    sevenDayUtilization: z.number().min(0).max(1),
    observedAt: z.iso.datetime({ offset: true }),
    // Deliberately a single literal, not a union with "live" -- see file
    // header. Widening this to accept a live source is a future, separately
    // authorized change, not an oversight.
    source: z.literal("simulated"),
  })
  .strict();
export type CapacityReading = z.infer<typeof CapacityReadingSchema>;

export const CapacityThresholdsSchema = z
  .object({
    warning: z.number().min(0).max(1),
    hardCap: z.number().min(0).max(1),
  })
  .strict()
  .superRefine((thresholds, ctx) => {
    if (thresholds.warning >= thresholds.hardCap) {
      ctx.addIssue({
        code: "custom",
        message: "warning threshold must be strictly below hardCap",
        path: ["warning"],
      });
    }
  });
export type CapacityThresholds = z.infer<typeof CapacityThresholdsSchema>;

/**
 * Section 22's worked example ("approaching limit — 12% remaining", i.e. 88%
 * utilization) falls between these two defaults. Section 29A.6 item 2 leaves
 * the real thresholds an open, evidence-pending decision -- these are a
 * documented starting point, not a value derived from any observed incident
 * (none has been observed; Section 29A.4).
 */
export const DEFAULT_CAPACITY_THRESHOLDS: CapacityThresholds = {
  warning: 0.85,
  hardCap: 0.97,
};

export type CapacityWatcherPhase = "in-progress" | "switched" | "paused";

export interface CapacityWatcherState {
  activeProvider: ProviderId;
  phase: CapacityWatcherPhase;
  /** Providers already warned this session, so a warning is raised once, not every reading. */
  warnedProviders: ProviderId[];
  /** Providers observed at or above hardCap at least once. */
  cappedProviders: ProviderId[];
}

export function initialCapacityWatcherState(activeProvider: ProviderId): CapacityWatcherState {
  return {
    activeProvider,
    phase: "in-progress",
    warnedProviders: [],
    cappedProviders: [],
  };
}

export type CapacityWatcherEventType =
  | "ProviderCapacityWarning"
  | "ProviderSwitchTriggered"
  | "ProviderSwitchCompleted"
  | "BothProvidersUnavailable";

export interface CapacityWatcherEvent {
  type: CapacityWatcherEventType;
  provider: ProviderId;
  reading: CapacityReading;
  /** Present only on ProviderSwitchTriggered / ProviderSwitchCompleted. */
  toProvider?: ProviderId;
}

export interface CapacityWatcherResult {
  state: CapacityWatcherState;
  events: CapacityWatcherEvent[];
}

function otherProvider(provider: ProviderId): ProviderId {
  return provider === "claude" ? "codex" : "claude";
}

/**
 * Advances the watcher by one observed reading. Bounded exactly to Section
 * 31's PR-0.5 exit evidence:
 *
 * - Below `warning`: no event, watcher stays "in-progress".
 * - At/above `warning`, below `hardCap`: one `ProviderCapacityWarning` per
 *   provider (not repeated on every subsequent reading).
 * - The active provider at/above `hardCap`, with the other provider not
 *   already known to be capped: `ProviderSwitchTriggered` then
 *   `ProviderSwitchCompleted`, active provider flips, phase becomes
 *   "switched".
 * - The active provider at/above `hardCap` with the other provider already
 *   known to be capped (in either order of observation): `BothProvidersUnavailable`,
 *   phase becomes the terminal "paused" state.
 * - Once paused, further readings are no-ops -- Section 29A.3 point 4: the
 *   watcher "does not poll ... unattended; resuming requires an explicit
 *   `beacon continue`", which this module does not implement (out of scope;
 *   there is nothing to poll against).
 */
export function evaluateCapacityReading(
  state: CapacityWatcherState,
  reading: CapacityReading,
  thresholds: CapacityThresholds = DEFAULT_CAPACITY_THRESHOLDS,
): CapacityWatcherResult {
  const parsedReading = CapacityReadingSchema.parse(reading);
  const parsedThresholds = CapacityThresholdsSchema.parse(thresholds);

  if (state.phase === "paused") {
    return { state, events: [] };
  }

  const next: CapacityWatcherState = {
    ...state,
    warnedProviders: [...state.warnedProviders],
    cappedProviders: [...state.cappedProviders],
  };
  const events: CapacityWatcherEvent[] = [];

  const utilization = Math.max(
    parsedReading.fiveHourUtilization,
    parsedReading.sevenDayUtilization,
  );
  const atHardCap = utilization >= parsedThresholds.hardCap;
  const atWarning = utilization >= parsedThresholds.warning;

  if (atHardCap && !next.cappedProviders.includes(parsedReading.provider)) {
    next.cappedProviders.push(parsedReading.provider);
  }

  if (parsedReading.provider !== next.activeProvider) {
    // A reading for the non-active provider only matters here if it closes
    // out a both-capped terminal state the active provider already entered.
    if (atHardCap && next.cappedProviders.includes(next.activeProvider)) {
      events.push({
        type: "BothProvidersUnavailable",
        provider: parsedReading.provider,
        reading: parsedReading,
      });
      next.phase = "paused";
    }
    return { state: next, events };
  }

  if (atHardCap) {
    const target = otherProvider(next.activeProvider);
    if (next.cappedProviders.includes(target)) {
      events.push({
        type: "BothProvidersUnavailable",
        provider: parsedReading.provider,
        reading: parsedReading,
      });
      next.phase = "paused";
    } else {
      events.push({
        type: "ProviderSwitchTriggered",
        provider: parsedReading.provider,
        reading: parsedReading,
        toProvider: target,
      });
      next.activeProvider = target;
      next.phase = "switched";
      events.push({
        type: "ProviderSwitchCompleted",
        provider: target,
        reading: parsedReading,
        toProvider: target,
      });
    }
  } else if (atWarning && !next.warnedProviders.includes(parsedReading.provider)) {
    next.warnedProviders.push(parsedReading.provider);
    events.push({
      type: "ProviderCapacityWarning",
      provider: parsedReading.provider,
      reading: parsedReading,
    });
  }

  return { state: next, events };
}

/**
 * Section 26's provider-continuity payload shapes, added here because PR-0.5
 * is the first PR to actually emit these event types (events.ts's own doc
 * comment: "per-event payload schemas are added as each later PR implements
 * the event it actually emits"). Reuses the existing `KnowledgeEventSchema`
 * envelope rather than inventing a parallel event shape.
 */
export const ProviderCapacityWarningPayloadSchema = z
  .object({
    provider: z.enum(["claude", "codex"]),
    fiveHourUtilization: z.number().min(0).max(1),
    sevenDayUtilization: z.number().min(0).max(1),
  })
  .strict();

export const ProviderSwitchTriggeredPayloadSchema = z
  .object({
    fromProvider: z.enum(["claude", "codex"]),
    toProvider: z.enum(["claude", "codex"]),
    reason: z.literal("hard-cap-reached"),
  })
  .strict();

export const ProviderSwitchCompletedPayloadSchema = z
  .object({
    fromProvider: z.enum(["claude", "codex"]),
    toProvider: z.enum(["claude", "codex"]),
  })
  .strict();

export const BothProvidersUnavailablePayloadSchema = z
  .object({
    claudeUtilization: z.number().min(0).max(1),
    codexUtilization: z.number().min(0).max(1),
  })
  .strict();

export const ProviderCapacityWarningEventSchema = KnowledgeEventSchema(
  ProviderCapacityWarningPayloadSchema,
);
export const ProviderSwitchTriggeredEventSchema = KnowledgeEventSchema(
  ProviderSwitchTriggeredPayloadSchema,
);
export const ProviderSwitchCompletedEventSchema = KnowledgeEventSchema(
  ProviderSwitchCompletedPayloadSchema,
);
export const BothProvidersUnavailableEventSchema = KnowledgeEventSchema(
  BothProvidersUnavailablePayloadSchema,
);
