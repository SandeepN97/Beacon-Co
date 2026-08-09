#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { evaluateToolPolicy } from "../../src/modules/orchestration/policy/tool-policy.ts";

async function readStdin() {
  let value = "";
  for await (const chunk of process.stdin) value += chunk;
  return value;
}

const raw = process.argv.includes("--input")
  ? await readFile(process.argv[process.argv.indexOf("--input") + 1], "utf8")
  : await readStdin();
const hook = raw.trim() ? JSON.parse(raw) : {};
const toolInput = hook.toolInput ?? hook.tool_input ?? {};
const request = {
  runId: hook.runId ?? hook.session_id ?? process.env.BEACON_RUN_ID ?? "unidentified-run",
  agentRole: hook.agentRole ?? process.env.BEACON_AGENT_ROLE ?? "chief-of-staff",
  toolName: hook.toolName ?? hook.tool_name ?? "Unknown",
  command: toolInput.command ?? null,
  path: toolInput.file_path ?? toolInput.path ?? null,
  allowedPaths: hook.allowedPaths ?? ["."],
  approvedDependencyChange: hook.approvedDependencyChange ?? false,
};

try {
  const result = evaluateToolPolicy(request);
  process.stdout.write(
    `${JSON.stringify({
      ...result,
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: result.decision,
        permissionDecisionReason: result.reason,
      },
    })}\n`,
  );
} catch (error) {
  process.stdout.write(
    `${JSON.stringify({
      schemaVersion: 1,
      decision: "deny",
      actionClass: "unknown",
      reason: "Invalid policy request; action denied without logging raw input.",
      error: error instanceof Error ? error.name : "UnknownError",
    })}\n`,
  );
  process.exitCode = 2;
}
