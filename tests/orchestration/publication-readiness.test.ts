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
const TREE = "c".repeat(40);
const passedGate: PublicationGateResult = {
  name: "quality",
  status: "passed",
  command: "npm test",
  evidence: ["exit:0"],
};

const evidence = (
  gates: PublicationGateResult[],
  publicationReady: boolean,
  candidateSha: string = SHA,
  candidateTree: string = TREE,
) => ({
  schemaVersion: 1,
  evidenceId: "prepublish-a",
  repository: "SandeepN97/Beacon-Co",
  branch: "phase15-closure-hardening",
  candidateSha,
  candidateTree,
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
    expect(validatePublicationCandidate(evidence([passedGate], true), SHA, TREE).ready).toBe(true);
  });

  it("keeps externalReady false without real external evidence", () => {
    expect(evidence([passedGate], true).externalReady).toBe(false);
  });

  it("invalidates publication evidence when the candidate tree changes", () => {
    const otherTree = "d".repeat(40);
    const otherSha = "b".repeat(40);
    const result = validatePublicationCandidate(evidence([passedGate], true), otherSha, otherTree);
    expect(result.ready).toBe(false);
    expect(result.reasons).toContain(
      `Publication evidence tree is stale: ${TREE} (from commit ${SHA}) does not match ${otherTree} (from commit ${otherSha}).`,
    );
  });

  it("accepts a matching tree even when the candidate commit SHA differs (post-merge)", () => {
    // This is the fix under test: GitHub always server-generates a new
    // commit SHA on merge (e.g. a squash-merge), so commit-SHA equality can
    // never survive a real merge. Content identity (the tree hash) does
    // survive it as long as no unrelated content changed, so evidence
    // generated pre-merge must remain valid against the post-merge commit
    // as long as the tree is unchanged.
    const mergeCommitSha = "e".repeat(40);
    const result = validatePublicationCandidate(
      evidence([passedGate], true, SHA, TREE),
      mergeCommitSha,
      TREE,
    );
    expect(result.ready).toBe(true);
  });

  it("still fails on content mismatch even if one SHA is a real ancestor of the other", () => {
    // This is NOT the rejected "ancestor of" relaxation (Option 1): the
    // comparison here is purely tree (content) based, not SHA/lineage
    // based, so a mismatched tree hash fails even when the commits
    // involved have a genuine ancestor relationship in git history. This
    // test expresses that at the schema/unit level via two distinct tree
    // hashes; it does not require an actual ancestor relationship in a
    // real git history to demonstrate that content equality, not commit
    // lineage, is what's being enforced.
    const ancestorTree = "f".repeat(40);
    const descendantSha = "1".repeat(40);
    const result = validatePublicationCandidate(
      evidence([passedGate], true, SHA, TREE),
      descendantSha,
      ancestorTree,
    );
    expect(result.ready).toBe(false);
    expect(result.reasons).toContain(
      `Publication evidence tree is stale: ${TREE} (from commit ${SHA}) does not match ${ancestorTree} (from commit ${descendantSha}).`,
    );
  });

  it("machine-denies publication when publicationReady is false", async () => {
    // authorize-publication.mjs resolves `${candidate}^{tree}` via a real
    // git call, so the candidate must be a real commit in this repository
    // (unlike the pure-unit tests above, which can use synthetic hex
    // strings). Using the real HEAD SHA here is sufficient: the evidence's
    // synthetic candidateTree still won't match HEAD's real tree, but this
    // test only asserts the (already-failing, due to the failed "browser"
    // gate) denial output shape.
    const realHeadSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const directory = await mkdtemp(join(tmpdir(), "beacon-publication-denial-"));
    const path = join(directory, "readiness.json");
    await writeFile(
      path,
      JSON.stringify(
        evidence([{ ...passedGate, name: "browser", status: "failed" }], false, realHeadSha),
      ),
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
          realHeadSha,
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
