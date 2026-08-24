import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  AdrLifecycleStatusSchema,
  LearningPackageLifecycleStatusSchema,
} from "../../src/modules/orchestration/decision-os/lifecycle.ts";

/**
 * PR-0A's contract-consistency test, per Section 31's exit evidence: "A
 * contract-consistency test verifying Appendix A's schema enums, 25A's
 * state diagrams, and this document's prose lifecycle descriptions cannot
 * drift apart — added after exactly this kind of drift was found and fixed
 * in V6.5.1 (ADR's missing DEPRECATED transition; LearningPackage's missing
 * `evaluating` status)."
 *
 * Scope, deliberately bounded: this checks consistency between artifacts
 * INSIDE the master spec document itself (Appendix A's inline enum text and
 * the corresponding Section 25A `.mmd` diagram source), for the two
 * entities where Appendix A states an explicit status enum -- ADRRef and
 * LearningPackage, the exact two V6.5.1 already found drifting from each
 * other and fixed (Section 0.9 items 1-2). It does not check the master
 * spec against this repo's separate, older PR-0 domain schemas
 * (decision.ts, research-thread.ts) -- lifecycle.ts's own file header
 * documents that separate, real drift as an explicit open finding instead.
 * ResearchThread, UnderstandingVersion, and DecisionCandidate are excluded
 * from the parsed check below because Appendix A's contract block for each
 * lists only a bare `status` field with no inline enum literal to compare
 * against their diagrams -- there is nothing to parse and cross-check for
 * those three the same mechanical way.
 */

const repoRoot = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
const specPath = path.join(repoRoot, "src/content/docs/plans/phase-1-6-master-spec.mdoc");
const adrDiagramPath = path.join(repoRoot, "public/diagrams/mermaid/phase-1-6-adr-lifecycle.mmd");
const learningPackageDiagramPath = path.join(
  repoRoot,
  "public/diagrams/mermaid/phase-1-6-learning-package-lifecycle.mmd",
);

function extractAppendixABlock(): string {
  const spec = readFileSync(specPath, "utf8");
  const startMarker = "## Appendix A. Canonical contracts";
  const endMarker = "## Appendix B.";
  const start = spec.indexOf(startMarker);
  if (start === -1) {
    throw new Error(`"${startMarker}" not found in phase-1-6-master-spec.mdoc`);
  }
  const end = spec.indexOf(endMarker, start);
  if (end === -1) {
    throw new Error(`"${endMarker}" not found after Appendix A -- cannot bound the block`);
  }
  return spec.slice(start, end);
}

function extractQuotedEnum(appendixABlock: string, entityHeader: string): string[] {
  const entityStart = appendixABlock.indexOf(`${entityHeader} {`);
  if (entityStart === -1) {
    throw new Error(`"${entityHeader} {" not found in Appendix A`);
  }
  const entityEnd = appendixABlock.indexOf("}", entityStart);
  if (entityEnd === -1) {
    throw new Error(`no closing "}" found for ${entityHeader} in Appendix A`);
  }
  const entityBlock = appendixABlock.slice(entityStart, entityEnd);
  const statusLine = entityBlock.split("\n").find((line) => line.trim().startsWith("status:"));
  if (!statusLine) {
    throw new Error(`no "status:" line found in ${entityHeader}'s Appendix A block`);
  }
  const values = [...statusLine.matchAll(/"([a-z-]+)"/g)].map((match) => match[1]);
  if (values.length === 0) {
    throw new Error(
      `no quoted enum values parsed from ${entityHeader}'s status line: "${statusLine}"`,
    );
  }
  return values;
}

function extractMermaidStateNames(diagramPath: string): string[] {
  const source = readFileSync(diagramPath, "utf8");
  const tokens = source.match(/\b[A-Z][A-Z_]*\b/g) ?? [];
  if (tokens.length === 0) {
    throw new Error(`no state-name tokens parsed from ${diagramPath}`);
  }
  return [...new Set(tokens)];
}

describe("Section 25A / Appendix A contract consistency (PR-0A, supports INV-003)", () => {
  it("ADR lifecycle: Appendix A's ADRRef.status enum matches the adr-lifecycle diagram's states", () => {
    const appendixEnum = extractQuotedEnum(extractAppendixABlock(), "ADRRef").sort();
    const diagramStates = extractMermaidStateNames(adrDiagramPath)
      .map((state) => state.toLowerCase())
      .sort();
    expect(diagramStates).toEqual(appendixEnum);
  });

  it("ADR lifecycle: this repo's lifecycle.ts AdrLifecycleStatusSchema matches Appendix A", () => {
    const appendixEnum = extractQuotedEnum(extractAppendixABlock(), "ADRRef").sort();
    expect([...AdrLifecycleStatusSchema.options].sort()).toEqual(appendixEnum);
  });

  it("LearningPackage lifecycle: Appendix A's LearningPackage.status enum matches the diagram's states", () => {
    const appendixEnum = extractQuotedEnum(extractAppendixABlock(), "LearningPackage").sort();
    const diagramStates = extractMermaidStateNames(learningPackageDiagramPath)
      .map((state) => state.toLowerCase())
      .sort();
    expect(diagramStates).toEqual(appendixEnum);
  });

  it("LearningPackage lifecycle: this repo's lifecycle.ts LearningPackageLifecycleStatusSchema matches Appendix A", () => {
    const appendixEnum = extractQuotedEnum(extractAppendixABlock(), "LearningPackage").sort();
    expect([...LearningPackageLifecycleStatusSchema.options].sort()).toEqual(appendixEnum);
  });

  it("fails loudly rather than silently passing if Appendix A's ADRRef block goes missing", () => {
    expect(() => extractQuotedEnum("no ADRRef here", "ADRRef")).toThrow();
  });

  it("fails loudly rather than silently passing if a diagram file is missing", () => {
    expect(() => extractMermaidStateNames("/nonexistent/path.mmd")).toThrow();
  });
});
