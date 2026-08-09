import { describe, expect, it } from "vitest";
import { evaluateToolPolicy } from "../../src/modules/orchestration/policy/tool-policy.ts";

function request(overrides: Record<string, unknown> = {}) {
  return {
    runId: "run-policy-1",
    agentRole: "code-writer",
    toolName: "Bash",
    command: "git status -sb",
    path: null,
    allowedPaths: ["src", "tests", ".github"],
    approvedDependencyChange: false,
    ...overrides,
  };
}

describe("deterministic tool policy", () => {
  it.each([
    "git push origin main --force",
    "git push -f origin main",
    "bash -c 'git reset --hard HEAD^'",
  ])("denies protected history mutation: %s", (command) => {
    expect(evaluateToolPolicy(request({ command })).decision).toBe("deny");
  });

  it.each([
    "rm -rf ../workspace",
    "rm -fr ./src",
    "find src -delete",
    "find src -print0 | xargs -0 rm -f",
  ])("denies destructive and bypass variants: %s", (command) => {
    expect(evaluateToolPolicy(request({ command })).decision).toBe("deny");
  });

  it.each(["cat .env", "sed -n '1p' config/private.pem", "cp .dev.vars /tmp/out"])(
    "denies secret-bearing paths without echoing them: %s",
    (command) => {
      const result = evaluateToolPolicy(request({ command }));
      expect(result.decision).toBe("deny");
      expect(result.actionClass).toBe("secret-access");
      expect(result.reason).not.toContain(command);
    },
  );

  it("denies repository path traversal", () => {
    expect(
      evaluateToolPolicy(request({ toolName: "Read", command: null, path: "../outside" })),
    ).toMatchObject({
      decision: "deny",
      actionClass: "scope-escape",
    });
  });

  it("keeps researcher Bash read-only", () => {
    expect(
      evaluateToolPolicy(request({ agentRole: "codebase-researcher", command: "rg -n TODO src" }))
        .decision,
    ).toBe("allow");
    expect(
      evaluateToolPolicy(request({ agentRole: "codebase-researcher", command: "touch src/new.ts" }))
        .decision,
    ).toBe("deny");
  });

  it("denies QA and reviewer source or dependency mutation", () => {
    expect(
      evaluateToolPolicy(
        request({ agentRole: "qa-engineer", toolName: "Edit", command: null, path: "src/a.ts" }),
      ).decision,
    ).toBe("deny");
    expect(
      evaluateToolPolicy(request({ agentRole: "qa-engineer", command: "npm install left-pad" }))
        .decision,
    ).toBe("deny");
    expect(
      evaluateToolPolicy(request({ agentRole: "pr-reviewer", command: "gh pr merge 42" })).decision,
    ).toBe("deny");
  });

  it("asks for publication and workflow dispatch", () => {
    expect(evaluateToolPolicy(request({ command: "git push origin feature" })).decision).toBe(
      "ask",
    );
    expect(
      evaluateToolPolicy(
        request({ agentRole: "release-manager", command: "gh workflow run deploy-production.yml" }),
      ),
    ).toMatchObject({ decision: "ask", actionClass: "workflow-dispatch" });
  });

  it("denies direct deployment for every role", () => {
    expect(
      evaluateToolPolicy(request({ agentRole: "release-manager", command: "npx wrangler deploy" })),
    ).toMatchObject({ decision: "deny", actionClass: "direct-deploy" });
  });

  it("allows scoped ordinary edits while hashing rather than logging content", () => {
    const result = evaluateToolPolicy(
      request({ toolName: "Edit", command: null, path: "src/a.ts" }),
    );
    expect(result).toMatchObject({ decision: "allow", actionClass: "source-mutation" });
    expect(result.requestFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });
});
