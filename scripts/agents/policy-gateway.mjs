#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { isAbsolute, relative } from "node:path";
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

// evaluateToolPolicy()/pathIsWithinScope() intentionally operate on paths
// relative to the current run's own working directory (allowedPaths
// defaults to ["."], meaning "everything under this run's cwd") -- that is
// what scopes each agent to its own worktree. Claude Code's actual tool
// calls always supply an absolute file_path, though, so it must be
// normalized to that relative frame here, at the hook boundary, before the
// pure domain function ever sees it. A path that resolves outside the run's
// cwd becomes a relative path containing ".." segments, which
// pathIsWithinScope() already rejects -- so this only changes how in-scope
// absolute paths are recognized, not what counts as in scope.
const rawPath = toolInput.file_path ?? toolInput.path ?? null;
const path = rawPath && isAbsolute(rawPath) ? relative(process.cwd(), rawPath) : rawPath;

const request = {
  runId: hook.runId ?? hook.session_id ?? process.env.BEACON_RUN_ID ?? "unidentified-run",
  agentRole: hook.agentRole ?? process.env.BEACON_AGENT_ROLE ?? "chief-of-staff",
  toolName: hook.toolName ?? hook.tool_name ?? "Unknown",
  command: toolInput.command ?? null,
  path,
  allowedPaths: hook.allowedPaths ?? ["."],
  approvedDependencyChange: hook.approvedDependencyChange ?? false,
};

// Claude Code's PreToolUse hook output schema validates the root object.
// It does not recognize this repo's internal ToolPolicyDecision fields
// (schemaVersion, runId, agentRole, actionClass, requestFingerprint) at the
// root, and its own legacy root-level `decision` field only accepts
// "approve"/"block" -- not this domain's "allow"/"deny"/"ask" vocabulary.
// Emit only the documented hook response shape; keep the full internal
// decision (available in `result`/the caught error) out of the root object.
try {
  const result = evaluateToolPolicy(request);
  process.stdout.write(
    `${JSON.stringify({
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
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `Invalid policy request; action denied without logging raw input (${
          error instanceof Error ? error.name : "UnknownError"
        }).`,
      },
    })}\n`,
  );
  process.exitCode = 2;
}
