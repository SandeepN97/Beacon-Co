#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  evaluatePublicationReadiness,
  PublicationReadinessEvidenceSchema,
} from "../../src/modules/orchestration/domain/publication-readiness.ts";

function valueAfter(flag, fallback = null) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1];
}

const base = valueAfter("--base", "origin/main");
const manifest = valueAfter(
  "--manifest",
  "agent-platform/publication/phase-1.5-closure-hardening.json",
);
const output = valueAfter("--output", "evidence/publication-readiness.json");
const titleFile = valueAfter("--title-file", "evidence/publication/pr-title.txt");
const bodyFile = valueAfter("--body-file", "evidence/publication/pr-body.md");

const readGit = (...args) => {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
};

const candidateSha = readGit("rev-parse", "HEAD");
const branch =
  readGit("branch", "--show-current") ||
  process.env.GITHUB_HEAD_REF ||
  process.env.GITHUB_REF_NAME ||
  "detached";
const repository = process.env.GITHUB_REPOSITORY ?? "SandeepN97/Beacon-Co";

const definitions = [
  {
    name: "candidate-state",
    kind: "local",
    program: "git",
    args: ["status", "--porcelain", "--untracked-files=normal"],
    requireEmptyOutput: true,
  },
  {
    name: "changed-path-classification",
    kind: "publication",
    program: "npm",
    args: ["run", "ci:changed-paths", "--", "--base", base, "--head", "HEAD"],
  },
  {
    name: "local-phase-audit",
    kind: "local",
    program: "npm",
    args: ["run", "phase15:audit:local"],
  },
  { name: "formatting", kind: "local", program: "npm", args: ["run", "format:check"] },
  { name: "lint", kind: "local", program: "npm", args: ["run", "lint"] },
  { name: "typecheck", kind: "local", program: "npm", args: ["run", "typecheck"] },
  { name: "unit-tests", kind: "local", program: "npm", args: ["run", "test:unit"] },
  {
    name: "agent-contracts-telemetry-evals-model-policy",
    kind: "local",
    program: "npm",
    args: ["run", "ci:agents"],
  },
  {
    name: "secrets-dependencies-licenses-workflows",
    kind: "local",
    program: "npm",
    args: ["run", "ci:security"],
  },
  {
    name: "documentation-and-build",
    kind: "local",
    program: "npm",
    args: ["run", "docs:build"],
  },
  { name: "built-links", kind: "local", program: "npm", args: ["run", "ci:links"] },
  {
    name: "browser-accessibility-responsive-reduced-motion-diagrams",
    kind: "local",
    program: "npm",
    args: ["run", "test:browser:prebuilt"],
  },
  {
    name: "deterministic-pr-metadata-render",
    kind: "publication",
    program: "npm",
    args: [
      "run",
      "publication:render",
      "--",
      "--manifest",
      manifest,
      "--title-output",
      titleFile,
      "--body-output",
      bodyFile,
    ],
  },
  {
    name: "pr-metadata-policy",
    kind: "publication",
    program: "npm",
    args: [
      "run",
      "ci:pr-policy",
      "--",
      "--title-file",
      titleFile,
      "--body-file",
      bodyFile,
      "--require-context",
    ],
  },
  {
    name: "publication-scope",
    kind: "publication",
    program: "npm",
    args: [
      "run",
      "publication:scope",
      "--",
      "--manifest",
      manifest,
      "--base",
      base,
      "--head",
      "HEAD",
    ],
  },
  {
    name: "publication-evidence-generate",
    kind: "publication",
    program: "npm",
    args: ["run", "publication:generate", "--", "--base", base, "--head", "HEAD"],
  },
  {
    name: "publication-evidence-validate",
    kind: "publication",
    program: "npm",
    args: [
      "run",
      "publication:validate",
      "--",
      "--input",
      "evidence/publication-evidence.json",
      "--schema-only",
    ],
  },
  {
    name: "candidate-diff-validation",
    kind: "publication",
    program: "git",
    args: ["diff", "--check", `${base}...HEAD`],
  },
];

const gates = [];
for (const definition of definitions) {
  const command = [definition.program, ...definition.args].join(" ");
  console.log(`\n[prepublish] ${definition.name}: ${command}`);
  const result = spawnSync(definition.program, definition.args, {
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  const outputWasExpected = !definition.requireEmptyOutput || result.stdout.trim() === "";
  const passed = result.status === 0 && outputWasExpected;
  if (!outputWasExpected) {
    console.error("Candidate state is dirty; commit the exact candidate before prepublication.");
  }
  gates.push({
    name: definition.name,
    status: passed ? "passed" : "failed",
    command,
    evidence: [`exit:${String(result.status ?? 1)}`],
  });
}

const decision = evaluatePublicationReadiness(gates);
const localGateNames = new Set(
  definitions
    .filter((definition) => definition.kind === "local")
    .map((definition) => definition.name),
);
const localReady = gates
  .filter((gate) => localGateNames.has(gate.name))
  .every((gate) => gate.status === "passed");
const record = PublicationReadinessEvidenceSchema.parse({
  schemaVersion: 1,
  evidenceId: `prepublish-${candidateSha}`,
  repository,
  branch,
  candidateSha,
  generatedAt: new Date().toISOString(),
  localReady,
  publicationReady: decision.ready,
  externalReady: false,
  gates,
});
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(record, null, 2)}\n`, {
  encoding: "utf8",
  mode: 0o600,
});
console.log(
  `\n${JSON.stringify(
    {
      localReady,
      publicationReady: decision.ready,
      externalReady: false,
      failedGates: decision.failedGates,
    },
    null,
    2,
  )}`,
);
if (!decision.ready) {
  console.error("PUBLICATION DENIED");
  process.exitCode = 1;
}
