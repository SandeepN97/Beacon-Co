import { describe, expect, it } from "vitest";
import {
  validateMentalModel,
  validateUnderstandingCheck,
  validateUnderstandingPackage,
  validateUnderstandingVersion,
} from "../../src/modules/orchestration/decision-os/understanding.ts";

const sha = (character: string) => character.repeat(64);

const versionBase = {
  schemaVersion: 1 as const,
  id: "version-1",
  threadId: "thread-1",
  createdAt: "2026-08-09T12:00:00.000Z",
  summary30s: "Astro static output needs no SSR adapter.",
  coreMechanism: "The build emits static HTML/CSS/JS with no server runtime.",
  deepModelRef: null,
  mentalModelRefs: [],
  boundaryConditions: [],
  contradictionRefs: [],
  unresolvedQuestions: [],
  observableUnderstandingChecks: [],
  derivedFromEvidenceRefs: [],
  evidenceSetHash: sha("a"),
  projectContextHash: sha("b"),
  supersedesVersionRef: null,
};

const mentalModelBase = {
  schemaVersion: 1 as const,
  id: "model-1",
  conceptRef: "astro-static-output",
  understandingVersionRef: "version-1",
  learningPurpose: "Explain why no SSR adapter is needed.",
  representationType: "mermaid" as const,
  renderer: "mermaid",
  sourceSpecRef: "plans/phase-1-6-master-spec.mdoc#section-15",
  accessibilityContract: "Provide an equivalent text description alongside the diagram.",
  authority: "exploratory" as const,
};

const checkBase = {
  schemaVersion: 1 as const,
  id: "check-1",
  understandingVersionRef: "version-1",
  kind: "explain-simply" as const,
  state: "unknown" as const,
};

const packageBase = {
  schemaVersion: 1 as const,
  conceptRef: "astro-static-output",
  understandingVersionRef: "version-1",
  summary30s: "Astro static output needs no SSR adapter.",
  prerequisiteRefs: [],
  mechanism: "The build emits static HTML/CSS/JS with no server runtime.",
  boundaryConditions: [],
  recommendedVisuals: [],
  interactionSpec: null,
  activeChecks: [],
  contradictionRefs: [],
  evidenceRefs: [],
  deepReferenceRefs: [],
};

describe("decision-os understanding version", () => {
  it("accepts a well-formed understanding version", () => {
    expect(validateUnderstandingVersion(versionBase).id).toBe("version-1");
  });

  it("rejects an unknown field", () => {
    expect(() => validateUnderstandingVersion({ ...versionBase, extraField: "nope" })).toThrow();
  });
});

describe("decision-os mental model authority", () => {
  it("accepts a canonical mermaid mental model", () => {
    expect(validateMentalModel({ ...mentalModelBase, authority: "canonical" }).authority).toBe(
      "canonical",
    );
  });

  it("accepts an exploratory excalidraw mental model", () => {
    expect(
      validateMentalModel({
        ...mentalModelBase,
        representationType: "excalidraw",
        authority: "exploratory",
      }).representationType,
    ).toBe("excalidraw");
  });

  it("rejects a canonical excalidraw mental model", () => {
    expect(() =>
      validateMentalModel({
        ...mentalModelBase,
        representationType: "excalidraw",
        authority: "canonical",
      }),
    ).toThrow(
      "without that promotion having produced a Mermaid/beacon-native canonical view instead",
    );
  });
});

describe("decision-os understanding check and package", () => {
  it("accepts each of the three check states", () => {
    for (const state of ["yes", "no", "unknown"]) {
      expect(validateUnderstandingCheck({ ...checkBase, state }).state).toBe(state);
    }
  });

  it("rejects an unknown check kind", () => {
    expect(() => validateUnderstandingCheck({ ...checkBase, kind: "guess" })).toThrow();
  });

  it("accepts a well-formed understanding package", () => {
    expect(validateUnderstandingPackage(packageBase).conceptRef).toBe("astro-static-output");
  });
});
