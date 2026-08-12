import { describe, expect, it } from "vitest";
import {
  EventVisibilitySchema,
  FreshnessClassSchema,
} from "../../src/modules/orchestration/decision-os/visibility.ts";

describe("decision-os visibility and freshness enums", () => {
  it("accepts each of the three visibility projections", () => {
    expect(EventVisibilitySchema.parse("private")).toBe("private");
    expect(EventVisibilitySchema.parse("internal")).toBe("internal");
    expect(EventVisibilitySchema.parse("public")).toBe("public");
  });

  it("rejects a visibility value outside the closed set", () => {
    expect(() => EventVisibilitySchema.parse("shared")).toThrow();
  });

  it("accepts each of the five freshness classes", () => {
    for (const value of ["foundational", "slow-changing", "current", "fast-changing", "ephemeral"]) {
      expect(FreshnessClassSchema.parse(value)).toBe(value);
    }
  });

  it("rejects a freshness value outside the closed set", () => {
    expect(() => FreshnessClassSchema.parse("stale")).toThrow();
  });
});
