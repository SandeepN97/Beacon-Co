import { createHash } from "node:crypto";
import {
  ToolPolicyDecisionSchema,
  ToolPolicyRequestSchema,
  type ToolPolicyDecision,
  type ToolPolicyRequest,
} from "../domain/tool-call.ts";

const SECRET_PATH =
  /(?:^|[\s"'=:/\\])(?:\.env(?:\.[^\s"'=/\\]+)?|\.dev\.vars|id_(?:rsa|dsa|ecdsa|ed25519)|[^\s"'=/\\]+\.(?:pem|p12|pfx|key)|credentials(?:\.json)?|secrets?)(?=$|[\s"'/:\\])/i;
const FORCE_PUSH =
  /\bgit\b[^\n;&|]*\bpush\b[^\n;&|]*(?:--force(?:-with-lease)?\b|(?:^|\s)-f(?:\s|$))/i;
const HARD_RESET = /\bgit\b[^\n;&|]*\breset\b[^\n;&|]*--hard\b/i;
const RECURSIVE_DELETE =
  /(?:\brm\b[^\n;&|]*(?:(?:^|\s)-[^\s]*(?:r[^\s]*f|f[^\s]*r)[^\s]*\b|--recursive\b[^\n;&|]*--force\b|--force\b[^\n;&|]*--recursive\b)|\bfind\b[^\n;&|]*\s-delete\b|\bxargs\b[^\n;&|]*\brm\b)/i;
const DIRECT_DEPLOY = /\b(?:npx\s+)?wrangler\b[^\n;&|]*\bdeploy\b/i;
const PACKAGE_MUTATION =
  /\b(?:npm|pnpm|yarn|bun)\b\s+(?:install|add|remove|uninstall|update|upgrade)\b|\b(?:pip|pip3)\b\s+install\b/i;
const GIT_PUBLICATION = /\bgit\b[^\n;&|]*\b(?:commit|push|tag)\b/i;
const PR_MUTATION = /\bgh\b[^\n;&|]*\bpr\b\s+(?:create|merge|close|edit|review)\b/i;
const WORKFLOW_DISPATCH = /\bgh\b[^\n;&|]*(?:workflow\s+run|api\b[^\n;&|]*dispatches)/i;
const READ_ONLY_COMMAND =
  /^\s*(?:(?:git\s+(?:status|diff|log|show|branch)|rg|grep|sed\s+-n|ls|pwd|find\s+[^\n]*?(?!-delete)|head|tail|wc|stat|shasum|sha256sum)\b)/i;

function fingerprint(request: ToolPolicyRequest): string {
  return createHash("sha256").update(JSON.stringify(request)).digest("hex");
}

function decision(
  request: ToolPolicyRequest,
  result: Pick<ToolPolicyDecision, "decision" | "actionClass" | "reason">,
): ToolPolicyDecision {
  return ToolPolicyDecisionSchema.parse({
    schemaVersion: 1,
    runId: request.runId,
    agentRole: request.agentRole,
    ...result,
    requestFingerprint: fingerprint(request),
  });
}

function pathIsWithinScope(path: string, allowedPaths: string[]): boolean {
  if (path.startsWith("/") || path.split(/[\\/]/).includes("..") || path.includes("\0"))
    return false;
  return allowedPaths.some(
    (allowed) =>
      allowed === "." || path === allowed || path.startsWith(`${allowed.replace(/\/$/, "")}/`),
  );
}

export function evaluateToolPolicy(input: unknown): ToolPolicyDecision {
  const request = ToolPolicyRequestSchema.parse(input);
  const command = request.command ?? "";
  const path = request.path ?? "";
  const combined = `${command}\n${path}`;

  if (SECRET_PATH.test(combined)) {
    return decision(request, {
      decision: "deny",
      actionClass: "secret-access",
      reason:
        "Secret, environment, credential, or private-key paths are not available to agent runs.",
    });
  }
  if (path && !pathIsWithinScope(path, request.allowedPaths)) {
    return decision(request, {
      decision: "deny",
      actionClass: "scope-escape",
      reason: "The requested path is outside the run's explicit repository-relative scope.",
    });
  }
  if (FORCE_PUSH.test(command) || HARD_RESET.test(command)) {
    return decision(request, {
      decision: "deny",
      actionClass: "git-history-rewrite",
      reason: "History rewriting and force publication are prohibited.",
    });
  }
  if (RECURSIVE_DELETE.test(command)) {
    return decision(request, {
      decision: "deny",
      actionClass: "destructive-operation",
      reason:
        "Recursive or indirect destructive deletion is prohibited outside a separately controlled safe-temp workflow.",
    });
  }
  if (DIRECT_DEPLOY.test(command)) {
    return decision(request, {
      decision: "deny",
      actionClass: "direct-deploy",
      reason: "Direct deploy commands bypass the reviewed promotion workflow.",
    });
  }
  if (PACKAGE_MUTATION.test(command)) {
    if (request.agentRole === "qa-engineer" || request.agentRole === "pr-reviewer") {
      return decision(request, {
        decision: "deny",
        actionClass: "dependency-mutation",
        reason: `${request.agentRole} cannot install or mutate dependencies.`,
      });
    }
    return decision(request, {
      decision: request.approvedDependencyChange ? "ask" : "deny",
      actionClass: "dependency-mutation",
      reason: request.approvedDependencyChange
        ? "The scoped dependency change requires explicit publication-time approval."
        : "Dependency mutation is not approved for this run.",
    });
  }
  if (request.agentRole === "codebase-researcher" && request.toolName === "Bash") {
    return decision(request, {
      decision: READ_ONLY_COMMAND.test(command) ? "allow" : "deny",
      actionClass: READ_ONLY_COMMAND.test(command) ? "inspection" : "source-mutation",
      reason: READ_ONLY_COMMAND.test(command)
        ? "The command is in the read-only inspection allowlist."
        : "Codebase researcher Bash access is restricted to read-only inspection commands.",
    });
  }
  if (
    (request.agentRole === "qa-engineer" || request.agentRole === "pr-reviewer") &&
    ["Edit", "Write"].includes(request.toolName)
  ) {
    return decision(request, {
      decision: "deny",
      actionClass: "source-mutation",
      reason: `${request.agentRole} cannot mutate source files.`,
    });
  }
  if (PR_MUTATION.test(command)) {
    if (request.agentRole === "pr-reviewer") {
      return decision(request, {
        decision: "deny",
        actionClass: "pr-mutation",
        reason: "Reviewer runs report findings but cannot mutate pull-request state.",
      });
    }
    return decision(request, {
      decision: "ask",
      actionClass: "pr-mutation",
      reason: "Pull-request publication or mutation requires explicit human authority.",
    });
  }
  if (WORKFLOW_DISPATCH.test(command)) {
    return decision(request, {
      decision: "ask",
      actionClass: "workflow-dispatch",
      reason: /deploy-production/i.test(command)
        ? "Production dispatch requires the external human-controlled environment gate."
        : "Workflow dispatch requires explicit human authority.",
    });
  }
  if (GIT_PUBLICATION.test(command)) {
    if (request.agentRole === "pr-reviewer") {
      return decision(request, {
        decision: "deny",
        actionClass: "git-publication",
        reason: "Reviewer runs cannot commit, tag, or push.",
      });
    }
    return decision(request, {
      decision: "ask",
      actionClass: "git-publication",
      reason: "Commit, tag, and push actions require explicit human authority.",
    });
  }

  return decision(request, {
    decision: "allow",
    actionClass: ["Edit", "Write"].includes(request.toolName) ? "source-mutation" : "inspection",
    reason: "The action is within declared role, path, and deterministic policy boundaries.",
  });
}
