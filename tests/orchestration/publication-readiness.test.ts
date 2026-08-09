import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  evaluatePublicationReadiness,
  validatePublicationCandidate,
  type PublicationGateResult,
} from "../../src/modules/orchestration/domain/publication-readiness.ts";

const SHA = "a".repeat(40);
const passedGate: PublicationGateResult = {
  name: "quality",
  status: "passed",
  command: "npm test",
  evidence: ["exit:0"],
};

const evidence = (gates: PublicationGateResult[], publicationReady: boolean) => ({
  schemaVersion: 1,
  evidenceId: "prepublish-a",
  repository: "SandeepN97/Beacon-Co",
  branch: "phase15-closure-hardening",
  candidateSha: SHA,
  generatedAt: "2026-08-09T12:00:00.000Z",
  localReady: true,
  publicationReady,
  externalReady: false,
  gates,
});

describe("publication readiness", () => {
  it("sets publicationReady false when a required check fails", () => {
    const decision = evaluatePublicationReadiness([
      passedGate,
      { ...passedGate, name: "browser", status: "failed" },
    ]);
    expect(decision).toMatchObject({ ready: false, failedGates: ["browser"] });
  });

  it("sets publicationReady true only when complete evidence passes", () => {
    expect(evaluatePublicationReadiness([passedGate])).toEqual({
      ready: true,
      failedGates: [],
      missingGates: [],
      reasons: [],
    });
    expect(validatePublicationCandidate(evidence([passedGate], true), SHA).ready).toBe(true);
  });

  it("keeps externalReady false without real external evidence", () => {
    expect(evidence([passedGate], true).externalReady).toBe(false);
  });

  it("invalidates publication evidence when the candidate SHA changes", () => {
    const result = validatePublicationCandidate(evidence([passedGate], true), "b".repeat(40));
    expect(result.ready).toBe(false);
    expect(result.reasons).toContain(
      `Publication evidence is stale: ${SHA} does not match ${"b".repeat(40)}.`,
    );
  });

  it("machine-denies publication when publicationReady is false", async () => {
    const directory = await mkdtemp(join(tmpdir(), "beacon-publication-denial-"));
    const path = join(directory, "readiness.json");
    await writeFile(
      path,
      JSON.stringify(evidence([{ ...passedGate, name: "browser", status: "failed" }], false)),
    );
    let stderr = "";
    try {
      execFileSync(
        process.execPath,
        [
          "--disable-warning=ExperimentalWarning",
          "--experimental-strip-types",
          "scripts/ci/authorize-publication.mjs",
          "--evidence",
          path,
          "--candidate",
          SHA,
        ],
        { encoding: "utf8" },
      );
    } catch (error) {
      stderr = String((error as { stderr?: string }).stderr ?? error);
    } finally {
      await rm(directory, { recursive: true });
    }
    expect(stderr).toContain("PUBLICATION DENIED");
    expect(stderr).toContain('"failedGates": [');
    expect(stderr).toContain('"browser"');
  });
});
