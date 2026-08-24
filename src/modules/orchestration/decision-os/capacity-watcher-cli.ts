import type { ProviderId } from "../domain/provider.ts";
import {
  DEFAULT_CAPACITY_THRESHOLDS,
  type CapacityReading,
  type CapacityThresholds,
} from "./capacity-watcher.ts";

/**
 * `beacon` CLI output text for the Capacity Watcher's in-progress/switched/
 * paused states, per ADR-0020's PR-0.5 bound and Section 22's worked
 * examples. No `beacon` executable exists in this repository yet (no `bin`
 * entry, no CLI entry point) -- these are pure, independently testable
 * string-rendering functions that produce the exact text Section 22 shows,
 * not a wired interactive command. Section 31's exit evidence for PR-0.5 is
 * "no UI change outside `beacon` CLI output"; rendering that output text is
 * the deliverable, not building the harness that would print it to a
 * terminal.
 */

function providerLabel(provider: ProviderId): string {
  return provider === "claude" ? "Claude" : "Codex";
}

/**
 * Section 22's status-line example: "Provider    Claude (approaching limit —
 * 12% remaining)". Below `thresholds.warning`, renders a healthy line
 * instead.
 */
export function formatProviderStatusLine(
  reading: CapacityReading,
  thresholds: CapacityThresholds = DEFAULT_CAPACITY_THRESHOLDS,
): string {
  const utilization = Math.max(reading.fiveHourUtilization, reading.sevenDayUtilization);
  const remainingPercent = Math.round((1 - utilization) * 100);
  const label = providerLabel(reading.provider);
  const state = utilization >= thresholds.warning ? "approaching limit" : "healthy";
  return `Provider    ${label} (${state} — ${remainingPercent}% remaining)`;
}

/**
 * Section 22's automatic-switch narration block:
 * "Beacon: Claude capacity reached mid-task.
 *   → Continuation package generated (observedAt: ...)
 *   → Switching to Codex
 *   → Codex: context loaded, resuming from last WorkUnit step
 *   → No user action required."
 *
 * This function only renders that narration text -- it does not call into
 * Phase 1.5's `ContinuationManager`. Actually constructing a real
 * `ContinuationPackage` requires a full `WorkUnit` and evidence trail
 * unrelated to capacity-watching; that responsibility already exists in
 * ../broker/continuation-manager.ts and stays there, not duplicated here.
 */
export function formatSwitchNarration(
  fromProvider: ProviderId,
  toProvider: ProviderId,
  observedAt: string,
): string {
  return [
    `Beacon: ${providerLabel(fromProvider)} capacity reached mid-task.`,
    `  → Continuation package generated (observedAt: ${observedAt})`,
    `  → Switching to ${providerLabel(toProvider)}`,
    `  → ${providerLabel(toProvider)}: context loaded, resuming from last WorkUnit step`,
    `  → No user action required.`,
  ].join("\n");
}

/**
 * Section 22's both-capped narration block:
 * "Beacon: Both Claude and Codex are at capacity.
 *   → Work paused, ContinuationPackage saved and current.
 *   → No provider action possible right now.
 *   → Resume with `beacon continue` once either provider is available."
 */
export function formatBothUnavailableNarration(): string {
  return [
    "Beacon: Both Claude and Codex are at capacity.",
    "  → Work paused, ContinuationPackage saved and current.",
    "  → No provider action possible right now.",
    "  → Resume with `beacon continue` once either provider is available.",
  ].join("\n");
}
