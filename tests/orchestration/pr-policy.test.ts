import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  renderPullRequestBody,
  type PublicationManifest,
} from "../../src/modules/orchestration/domain/publication-manifest.ts";
import { validatePullRequestPolicy } from "../../src/modules/orchestration/publication/pr-policy.ts";

const manifest: PublicationManifest = {
  schemaVersion: 1,
  title: "Harden Phase 1.5 publication readiness",
  summary: ["Separate readiness states."],
  risk: ["Low and reversible."],
  testEvidence: ["npm test passed."],
  documentationImpact: ["Phase 1.5 audit updated."],
  rollback: ["Revert the commit."],
  allowedPathPrefixes: ["scripts"],
};
const createdDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirectories.splice(0).map((path) => rm(path, { recursive: true })));
});

async function runCli(input: { title: string; body: string; event?: boolean }) {
  const directory = await mkdtemp(join(tmpdir(), "beacon-pr-policy-"));
  createdDirectories.push(directory);
  const titlePath = join(directory, "title.txt");
  const bodyPath = join(directory, "body.md");
  const eventPath = join(directory, "event.json");
  await Promise.all([
    writeFile(titlePath, input.title),
    writeFile(bodyPath, input.body),
    writeFile(
      eventPath,
      JSON.stringify({
        pull_request: { title: input.title, body: input.body, head: {}, base: {} },
      }),
    ),
  ]);
  const args = [
    "--disable-warning=ExperimentalWarning",
    "--experimental-strip-types",
    "scripts/ci/validate-pr-policy.mjs",
    ...(input.event
      ? ["--event", eventPath, "--require-context"]
      : ["--title-file", titlePath, "--body-file", bodyPath, "--require-context"]),
  ];
  try {
    return execFileSync(process.execPath, args, { encoding: "utf8" });
  } catch (error) {
    return String((error as { stderr?: string }).stderr ?? error);
  }
}

describe("canonical PR metadata policy", () => {
  it("does not allow required publication validation to skip without context", () => {
    let stderr = "";
    try {
      execFileSync(
        process.execPath,
        [
          "--disable-warning=ExperimentalWarning",
          "--experimental-strip-types",
          "scripts/ci/validate-pr-policy.mjs",
          "--require-context",
        ],
        { encoding: "utf8", env: { ...process.env, GITHUB_EVENT_PATH: "" } },
      );
    } catch (error) {
      stderr = String((error as { stderr?: string }).stderr ?? error);
    }
    expect(stderr).toContain("Explicit PR metadata or a pull-request event is required.");
  });

  it("rejects a missing required heading locally", async () => {
    const body = renderPullRequestBody(manifest).replace("## Rollback", "## Recovery");
    expect(validatePullRequestPolicy({ title: manifest.title, body }).valid).toBe(false);
    expect(await runCli({ title: manifest.title, body })).toContain(
      "PR body must contain exactly one ## Rollback heading.",
    );
  });

  it("rejects a malformed title locally", () => {
    expect(
      validatePullRequestPolicy({ title: "fix", body: renderPullRequestBody(manifest) }),
    ).toEqual(expect.objectContaining({ valid: false }));
  });

  it("accepts a complete deterministically generated body locally", async () => {
    const body = renderPullRequestBody(manifest);
    expect(validatePullRequestPolicy({ title: manifest.title, body })).toEqual({
      valid: true,
      errors: [],
    });
    expect(await runCli({ title: manifest.title, body })).toContain("PR metadata policy passed.");
  });

  it("uses the same rules for GitHub events", async () => {
    const passingBody = renderPullRequestBody(manifest);
    expect(await runCli({ title: manifest.title, body: passingBody, event: true })).toContain(
      "PR metadata policy passed.",
    );
    expect(
      await runCli({
        title: manifest.title,
        body: passingBody.replace("## Risk", "## Concern"),
        event: true,
      }),
    ).toContain("PR body must contain exactly one ## Risk heading.");
  });
});
