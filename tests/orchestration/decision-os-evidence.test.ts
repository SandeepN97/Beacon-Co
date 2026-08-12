import { describe, expect, it } from "vitest";
import {
  validateEvidence,
  validateSource,
} from "../../src/modules/orchestration/decision-os/evidence.ts";

const sourceBase = {
  schemaVersion: 1 as const,
  id: "source-1",
  canonicalUri: "https://example.test/astro-static-output",
  sourceType: "primary-technical" as const,
  title: "Astro static output guide",
  authorOrOrg: "Astro",
  publishedAt: "2026-01-01T00:00:00.000Z",
  retrievedAt: "2026-08-09T12:00:00.000Z",
  versionOrCommit: "7.2.0",
  freshnessClass: "current" as const,
  integrityHash: null,
  licenseOrUsageNotes: null,
  // Exercises the same-module import of DataClassificationSchema from
  // ../domain/work-request.ts (this file used to import it cross-module,
  // from ../../orchestration/domain/, before decision-os moved inside
  // orchestration/).
  dataClassification: "public" as const,
};

const evidenceBase = {
  schemaVersion: 1 as const,
  id: "evidence-1",
  sourceRef: "source-1",
  retrievedAt: "2026-08-09T12:00:00.000Z",
  sourceType: "primary-technical" as const,
  claimRefs: ["claim-1"],
  supports: ["claim-1"],
  contradicts: [],
  qualitySignals: [],
  applicabilityToBeacon: null,
  freshnessClass: "current" as const,
  staleAfter: null,
  excerptRef: null,
  artifactHash: null,
  notes: null,
};

describe("decision-os source and evidence", () => {
  it("accepts a well-formed source with a valid data classification", () => {
    expect(validateSource(sourceBase).dataClassification).toBe("public");
  });

  it("rejects a source with an invalid data classification", () => {
    expect(() => validateSource({ ...sourceBase, dataClassification: "top-secret" })).toThrow();
  });

  it("accepts a well-formed evidence record", () => {
    expect(validateEvidence(evidenceBase).id).toBe("evidence-1");
  });

  it("rejects a claim both supported and contradicted by the same evidence record", () => {
    expect(() =>
      validateEvidence({ ...evidenceBase, supports: ["claim-1"], contradicts: ["claim-1"] }),
    ).toThrow("a claim cannot be both supported and contradicted by the same evidence record");
  });

  it("rejects an unknown field on either schema", () => {
    expect(() => validateSource({ ...sourceBase, extraField: "nope" })).toThrow();
    expect(() => validateEvidence({ ...evidenceBase, extraField: "nope" })).toThrow();
  });
});
