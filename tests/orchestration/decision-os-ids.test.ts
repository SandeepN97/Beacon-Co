import { describe, expect, it } from "vitest";
import {
  ClaimIdSchema,
  DecisionPackageIdSchema,
  EvidenceIdSchema,
  KnowledgeEventIdSchema,
  SourceIdSchema,
} from "../../src/modules/orchestration/decision-os/ids.ts";

describe("decision-os typed IDs", () => {
  it("accepts a non-empty bounded string for any entity ID", () => {
    expect(ClaimIdSchema.parse("claim-1")).toBe("claim-1");
    expect(SourceIdSchema.parse("source-1")).toBe("source-1");
    expect(EvidenceIdSchema.parse("evidence-1")).toBe("evidence-1");
    expect(DecisionPackageIdSchema.parse("decision-package-1")).toBe("decision-package-1");
    expect(KnowledgeEventIdSchema.parse("event-1")).toBe("event-1");
  });

  it("rejects an empty ID", () => {
    expect(() => ClaimIdSchema.parse("")).toThrow();
  });

  it("rejects an ID longer than 160 characters", () => {
    expect(() => ClaimIdSchema.parse("c".repeat(161))).toThrow();
    expect(ClaimIdSchema.parse("c".repeat(160))).toBe("c".repeat(160));
  });

  it("rejects a non-string value", () => {
    expect(() => ClaimIdSchema.parse(123)).toThrow();
  });

  it("keeps distinct entity IDs as distinct branded schemas at the value level", () => {
    // The brand is a type-level guarantee (checked by `npm run typecheck`, not at
    // runtime), but every entity's schema independently enforces the same bounded
    // non-empty string shape.
    const claimId = ClaimIdSchema.parse("shared-value");
    const sourceId = SourceIdSchema.parse("shared-value");
    expect(claimId).toBe(sourceId);
  });
});
