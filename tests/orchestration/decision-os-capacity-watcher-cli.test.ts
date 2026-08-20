import { describe, expect, it } from "vitest";
import {
  formatBothUnavailableNarration,
  formatProviderStatusLine,
  formatSwitchNarration,
} from "../../src/modules/orchestration/decision-os/capacity-watcher-cli.ts";
import type { CapacityReading } from "../../src/modules/orchestration/decision-os/capacity-watcher.ts";

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

describe("formatProviderStatusLine", () => {
  it("matches Section 22's approaching-limit example text", () => {
    const line = formatProviderStatusLine(reading({ fiveHourUtilization: 0.88 }));
    expect(line).toBe("Provider    Claude (approaching limit — 12% remaining)");
  });

  it("renders a healthy line below the warning threshold", () => {
    const line = formatProviderStatusLine(reading({ fiveHourUtilization: 0.2 }));
    expect(line).toBe("Provider    Claude (healthy — 80% remaining)");
  });

  it("renders Codex's label for a codex reading", () => {
    const line = formatProviderStatusLine(reading({ provider: "codex", fiveHourUtilization: 0.9 }));
    expect(line).toContain("Codex");
  });
});

describe("formatSwitchNarration", () => {
  it("matches Section 22's automatic-switch narration block", () => {
    const text = formatSwitchNarration("claude", "codex", "2026-08-10T14:32:01Z");
    expect(text).toBe(
      [
        "Beacon: Claude capacity reached mid-task.",
        "  → Continuation package generated (observedAt: 2026-08-10T14:32:01Z)",
        "  → Switching to Codex",
        "  → Codex: context loaded, resuming from last WorkUnit step",
        "  → No user action required.",
      ].join("\n"),
    );
  });

  it("renders the reverse direction (Codex to Claude) correctly", () => {
    const text = formatSwitchNarration("codex", "claude", "2026-08-11T09:00:00Z");
    expect(text).toContain("Beacon: Codex capacity reached mid-task.");
    expect(text).toContain("Switching to Claude");
  });
});

describe("formatBothUnavailableNarration", () => {
  it("matches Section 22's both-capped narration block", () => {
    expect(formatBothUnavailableNarration()).toBe(
      [
        "Beacon: Both Claude and Codex are at capacity.",
        "  → Work paused, ContinuationPackage saved and current.",
        "  → No provider action possible right now.",
        "  → Resume with `beacon continue` once either provider is available.",
      ].join("\n"),
    );
  });
});
