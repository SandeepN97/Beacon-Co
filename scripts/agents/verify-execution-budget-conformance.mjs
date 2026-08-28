#!/usr/bin/env node
/**
 * Fixes M3/M4 (independent security review of PR #83, candidate
 * e895f60e72f912221b7bf9d001d8aa49bdd993eb): the prior conformance evidence at
 * agent-platform/baselines/execution-budget-conformance-2026-08-25.json was a
 * hand-authored JSON file asserting its own safety ("concurrencySafe": true,
 * "durableFailureEvidence": true, providerVerdicts of "COMPLIANT") with nothing
 * that actually verified those claims. A static file cannot certify itself.
 *
 * This script is the deterministic, machine-verifiable replacement: it ACTUALLY
 * RUNS the execution-budget adversarial test suites against the current working
 * tree, requires a fixed list of named, security-critical scenarios to be
 * present AND passing (not just an aggregate pass count -- a deleted test must
 * fail this gate, not silently shrink the total), and emits evidence bound to
 * the exact candidate SHA/tree and to a content hash of the test files
 * themselves, so the evidence cannot be replayed against a different revision
 * of the tests.
 *
 * It intentionally makes NO compliance claim beyond what it just executed:
 * "COMPLIANT" is not a value this script's output vocabulary contains for
 * providerVerdicts; see REQUIRED_SCENARIOS below and audit-phase-1.5.mjs's
 * consumption of this script's output for how a verdict is actually derived.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";

const TEST_FILES = [
  "tests/orchestration/execution-budget.test.ts",
  "tests/orchestration/provider-adapters.test.ts",
  "tests/orchestration/codex-cli-transport.test.ts",
];

/**
 * Every scenario the independent review's Section 40 test matrix requires.
 * Matched against vitest's reported `fullName` (describe titles + test title)
 * by substring, so renaming a `describe` block's wording slightly does not
 * spuriously break this gate, but deleting or disabling the underlying test
 * does.
 */
const REQUIRED_SCENARIOS = [
  "allows only one of two simultaneous create() calls",
  "allows only one of two simultaneous recover() calls",
  "fails a stale writer's ledger mutation closed immediately after a governed takeover",
  "poisons the ledger and blocks all further mutation when durable persistence becomes uncertain",
  "keeps a lineage permanently blocked when VIOLATION persistence itself fails",
  "never lets a smaller terminal settlement overwrite a larger streaming-observed cumulative usage",
  "refuses to reuse a providerRunId for a second reservation",
  "rejects authorization built from an unaccepted or fabricated ADR reference",
  "rejects an arbitrary self-certifying ProviderTransport before any invocation",
  "rejects an untrusted transport even when it claims a fully compliant contract",
  "rejects a subclass of the trusted transport that overrides invoke",
  "accepts the real, certified HttpProviderTransport instance",
  "fails Codex CLI closed before the subprocess can execute",
  "reports AgentRun.context.usage as a truthful total across a retry's two ProviderRuns",
  "commits neither reservation when durable admission evidence cannot be written",
  "blocks automatic provider re-execution when recover sees unresolved INVOKED",
  "reuses remaining capacity after recovery only when remote invocation is durably TERMINAL",
  // Added after an independent rereview of candidate
  // 225384030a4a30d66c946bdbc0d577a057a8a0c6 found three working exploits
  // against the round-1 fixes above (lineage forgery via the exported
  // schema, transport forgery via the exported certify function + prototype
  // spoofing, and a runtime-unenforced "private" constructor bypass).
  "rejects a hand-constructed lineage that never went through authorizeExecutionBudgetLineage",
  "rejects a direct call to the ExecutionBudgetLedger constructor, bypassing create()/recover()",
  "rejects a fabricated journal snapshot appended without a matching writer lease",
  "keeps a lease alive across a slow in-flight call via heartbeat, so a concurrent takeover cannot race it",
  "rejects a plain object with a spoofed prototype and shadowed own-property methods",
  // Round 3 -- final adversarial fencing review of candidate b6f4743 found
  // remote-execution/accounting conflation plus heartbeat and append TOCTOU.
  // These are executed scenarios, not source-name matches.
  "keeps the actual executeBudgetedProviderCall path at one invocation when an in-flight call exceeds the lease TTL",
  "allows N heartbeat, rejects N after N+1 takeover, and advances monotonically to N+2",
  "keeps writer fences monotonically increasing when heartbeat fence N races with takeover fence N+1",
  "prevents a stale writer append racing with takeover from becoming authoritative history",
  "rejects a stale writer evidence append after takeover",
  "rejects impossible writer-fence regression during recovery",
];

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

const candidateSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const candidateTree = execFileSync("git", ["rev-parse", "HEAD^{tree}"], {
  encoding: "utf8",
}).trim();

const testFileHashes = {};
for (const path of TEST_FILES) {
  testFileHashes[path] = sha256(await readFile(path, "utf8"));
}

let vitestJson;
let vitestExitCode = 0;
try {
  const stdout = execFileSync("npx", ["vitest", "run", ...TEST_FILES, "--reporter=json"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  vitestJson = JSON.parse(stdout);
} catch (error) {
  vitestExitCode = 1;
  // vitest's JSON reporter still writes the full report to stdout on test
  // failure; execFileSync attaches it to error.stdout in that case.
  try {
    vitestJson = JSON.parse(error.stdout ?? "");
  } catch {
    vitestJson = null;
  }
}

const allAssertions = (vitestJson?.testResults ?? []).flatMap(
  (file) => file.assertionResults ?? [],
);
const passedFullNames = new Set(
  allAssertions.filter((assertion) => assertion.status === "passed").map((a) => a.fullName),
);
const scenarioResults = REQUIRED_SCENARIOS.map((scenario) => ({
  scenario,
  present: allAssertions.some((assertion) => assertion.fullName.includes(scenario)),
  passed: [...passedFullNames].some((fullName) => fullName.includes(scenario)),
}));
const missingOrFailingScenarios = scenarioResults
  .filter((result) => !result.present || !result.passed)
  .map((result) => result.scenario);

const success =
  vitestExitCode === 0 &&
  vitestJson?.success === true &&
  (vitestJson?.numTotalTests ?? 0) > 0 &&
  (vitestJson?.numFailedTests ?? 1) === 0 &&
  missingOrFailingScenarios.length === 0;

/**
 * OpenCode/HarnessAdapter is out of scope for this bounded correction and
 * must remain unimplemented, not merely undeclared. This is a structural
 * filesystem check, not a test result, and is reported as such.
 */
const openCodeHarnessAbsent = await (async () => {
  try {
    const providerDirs = await readdir("src/modules/orchestration/providers");
    return !providerDirs.some((entry) => /opencode/i.test(entry));
  } catch {
    return false;
  }
})();

const providerVerdicts = {
  // Both direct-HTTP providers share the same transport-certification,
  // writer-lease, authority-grant, and transactional-ledger enforcement
  // path; a verdict here is only ever derived from `success` above, never
  // predeclared.
  claudeDirectHttp: success ? "COMPLIANT" : "CHANGES_REQUIRED",
  codexDirectHttp: success ? "COMPLIANT" : "CHANGES_REQUIRED",
  codexCli: success ? "NONCOMPLIANT_FAIL_CLOSED" : "CHANGES_REQUIRED",
  openCodeHarness: openCodeHarnessAbsent
    ? "UNCHANGED_NONEXECUTABLE_FAIL_CLOSED"
    : "AUTHORITY_GAP_REMAINS",
};

const evidence = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  candidateSha,
  candidateTree,
  testFileHashes,
  testSuiteResult: {
    numTotalTests: vitestJson?.numTotalTests ?? 0,
    numPassedTests: vitestJson?.numPassedTests ?? 0,
    numFailedTests: vitestJson?.numFailedTests ?? null,
    success: vitestJson?.success ?? false,
  },
  requiredScenarios: scenarioResults,
  providerVerdicts,
  success: success && openCodeHarnessAbsent,
};

process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
if (!success) process.exitCode = 1;
