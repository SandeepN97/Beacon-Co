import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  loadAgentContractInputs,
  validateAgentContractData,
} from "../../scripts/agents/validate-agent-contracts.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

async function loadFixture() {
  const { manifest, agentSources } = await loadAgentContractInputs(root);
  return {
    manifest: JSON.parse(JSON.stringify(manifest)),
    agentSources: new Map(agentSources),
  };
}

describe("agent contract manifest", () => {
  it("validates the fixed eight-role repository contract", async () => {
    const fixture = await loadFixture();
    expect(validateAgentContractData(fixture.manifest, fixture.agentSources)).toEqual([]);
  });

  it("rejects frontmatter tool drift", async () => {
    const fixture = await loadFixture();
    const file = ".claude/agents/chief-of-staff.md";
    fixture.agentSources.set(
      file,
      fixture.agentSources.get(file).replace("tools: Read, Glob, Grep", "tools: Read, Glob"),
    );
    expect(validateAgentContractData(fixture.manifest, fixture.agentSources)).toContain(
      "chief-of-staff: frontmatter tools drift from allowedTools.",
    );
  });

  it("rejects prose-contract drift even when frontmatter is unchanged", async () => {
    const fixture = await loadFixture();
    const file = ".claude/agents/release-manager.md";
    fixture.agentSources.set(
      file,
      fixture.agentSources.get(file).replace("# Release Manager", "# Release Coordinator"),
    );
    expect(validateAgentContractData(fixture.manifest, fixture.agentSources)).toContain(
      "release-manager: source definition SHA-256 drift.",
    );
  });

  it("rejects expansion beyond the fixed role set", async () => {
    const fixture = await loadFixture();
    fixture.manifest.roles.pop();
    const errors = validateAgentContractData(fixture.manifest, fixture.agentSources);
    expect(errors).toContain(
      "roles must be exactly the fixed set: chief-of-staff, market-researcher, codebase-researcher, code-writer, qa-engineer, pr-reviewer, release-manager, token-auditor.",
    );
    expect(errors).toContain("roles must contain 8 entries.");
  });

  it("rejects unknown handoffs, approvals, tests, and eval scenarios", async () => {
    const fixture = await loadFixture();
    const role = fixture.manifest.roles[0];
    role.allowedHandoffs.push("ninth-agent");
    role.security.approvalRequirements.push("silent-production-bypass");
    role.deterministicTests.push("model-vote-overrides-failure");
    role.liveEvalScenarios.push("unbounded-context");
    const errors = validateAgentContractData(fixture.manifest, fixture.agentSources);
    expect(errors).toContain("chief-of-staff: unknown handoff ninth-agent.");
    expect(errors).toContain("chief-of-staff: unknown approval silent-production-bypass.");
    expect(errors).toContain(
      "chief-of-staff: unknown deterministic test model-vote-overrides-failure.",
    );
    expect(errors).toContain("chief-of-staff: unknown live eval scenario unbounded-context.");
  });

  it("rejects invalid context and output budgets", async () => {
    const fixture = await loadFixture();
    const role = fixture.manifest.roles.find(({ id }) => id === "token-auditor");
    role.limits.maxContextTokens = 0;
    role.limits.maxOutputTokens = 9000;
    const errors = validateAgentContractData(fixture.manifest, fixture.agentSources);
    expect(errors).toContain("token-auditor: limits.maxContextTokens must be a positive integer.");
    expect(errors).toContain("token-auditor: maxOutputTokens must be lower than maxContextTokens.");
  });
});
