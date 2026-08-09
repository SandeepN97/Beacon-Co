import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("publication evidence CLI", () => {
  it("resolves symbolic refs and schema-validates non-authorizing prepublication evidence", async () => {
    const directory = await mkdtemp(join(tmpdir(), "beacon-publication-evidence-"));
    const output = join(directory, "publication.json");
    const nodeArgs = ["--disable-warning=ExperimentalWarning", "--experimental-strip-types"];
    try {
      execFileSync(
        process.execPath,
        [
          ...nodeArgs,
          "scripts/agents/generate-publication-evidence.mjs",
          "--base",
          "HEAD",
          "--head",
          "HEAD",
          "--output",
          output,
        ],
        { encoding: "utf8" },
      );
      const evidence = JSON.parse(await readFile(output, "utf8"));
      expect(evidence.baseSha).toMatch(/^[a-f0-9]{40}$/);
      expect(evidence.headSha).toBe(evidence.baseSha);
      expect(
        execFileSync(
          process.execPath,
          [
            ...nodeArgs,
            "scripts/agents/validate-publication-evidence.mjs",
            "--input",
            output,
            "--schema-only",
          ],
          { encoding: "utf8" },
        ),
      ).toContain('"schemaValid": true');
    } finally {
      await rm(directory, { recursive: true });
    }
  });
});
