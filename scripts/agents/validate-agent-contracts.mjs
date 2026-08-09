import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

export const EXPECTED_AGENT_IDS = [
  "chief-of-staff",
  "market-researcher",
  "codebase-researcher",
  "code-writer",
  "qa-engineer",
  "pr-reviewer",
  "release-manager",
  "token-auditor",
];

const EXPECTED_PROVIDERS = ["claude", "codex"];
const DATA_CLASSIFICATIONS = ["public", "internal", "confidential", "restricted"];
const ROUTING_STRATEGIES = [
  "claude-first",
  "code-affinity",
  "independent-second-voice",
  "capacity-aware",
];
const PERMISSION_MODES = ["plan", "default"];
const ISOLATION_MODES = ["none", "worktree"];
const MEMORY_MODES = ["none", "project"];

function uniqueStrings(value, label, errors, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    errors.push(`${label} must be ${allowEmpty ? "an" : "a non-empty"} array.`);
    return [];
  }
  if (value.some((item) => typeof item !== "string" || item.trim() === "")) {
    errors.push(`${label} must contain only non-empty strings.`);
    return [];
  }
  if (new Set(value).size !== value.length) errors.push(`${label} contains duplicate values.`);
  return value;
}

function objectKeys(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value) : [];
}

function compareSets(actual, expected) {
  return (
    actual.length === expected.length &&
    [...actual].sort().every((value, index) => value === [...expected].sort()[index])
  );
}

export function parseAgentFrontmatter(source, file) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error(`${file}: missing YAML frontmatter.`);
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 1) throw new Error(`${file}: invalid flat frontmatter line: ${line}`);
    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();
    if (/^-?\d+$/.test(rawValue)) data[key] = Number(rawValue);
    else if (rawValue === "true" || rawValue === "false") data[key] = rawValue === "true";
    else data[key] = rawValue.replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, "$1$2");
  }
  return data;
}

function frontmatterTools(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    return value
      .split(",")
      .map((tool) => tool.trim())
      .filter(Boolean);
  }
  return [];
}

export async function loadAgentContractInputs(root) {
  const manifestPath = resolve(root, "agent-platform/agent-contracts.yml");
  const manifest = parse(await readFile(manifestPath, "utf8"));
  const agentDirectory = resolve(root, ".claude/agents");
  const agentFiles = (await readdir(agentDirectory)).filter((name) => name.endsWith(".md")).sort();
  const agentSources = new Map();
  for (const name of agentFiles) {
    const path = resolve(agentDirectory, name);
    agentSources.set(relative(root, path).replaceAll("\\", "/"), await readFile(path, "utf8"));
  }
  return { manifest, agentSources };
}

export function validateAgentContractData(manifest, agentSources) {
  const errors = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return ["Manifest must be a YAML object."];
  }

  if (manifest.schemaVersion !== 1) errors.push("schemaVersion must be 1.");
  if (manifest.phase !== "1.5") errors.push('phase must be "1.5".');
  if (manifest.roleSet?.fixed !== true) errors.push("roleSet.fixed must be true.");
  if (manifest.roleSet?.count !== EXPECTED_AGENT_IDS.length) {
    errors.push(`roleSet.count must be ${EXPECTED_AGENT_IDS.length}.`);
  }

  const providers = uniqueStrings(manifest.providers, "providers", errors);
  if (!compareSets(providers, EXPECTED_PROVIDERS)) {
    errors.push(`providers must be exactly: ${EXPECTED_PROVIDERS.join(", ")}.`);
  }
  const toolCatalog = uniqueStrings(manifest.toolCatalog, "toolCatalog", errors);
  const forbiddenClassCatalog = objectKeys(manifest.forbiddenToolClassCatalog);
  if (!forbiddenClassCatalog.length) {
    errors.push("forbiddenToolClassCatalog must be a non-empty object.");
  }
  for (const [name, description] of Object.entries(manifest.forbiddenToolClassCatalog ?? {})) {
    if (typeof description !== "string" || description.trim() === "") {
      errors.push(`forbiddenToolClassCatalog.${name} must have a description.`);
    }
  }
  const approvalCatalog = uniqueStrings(manifest.approvalCatalog, "approvalCatalog", errors);
  const deterministicTestCatalog = uniqueStrings(
    manifest.deterministicTestCatalog,
    "deterministicTestCatalog",
    errors,
  );
  const liveEvalScenarioCatalog = uniqueStrings(
    manifest.liveEvalScenarioCatalog,
    "liveEvalScenarioCatalog",
    errors,
  );

  if (!Array.isArray(manifest.roles)) {
    errors.push("roles must be an array.");
    return errors;
  }

  const roleIds = manifest.roles.map((role) => role?.id).filter((id) => typeof id === "string");
  if (new Set(roleIds).size !== roleIds.length) errors.push("roles contains duplicate role IDs.");
  if (!compareSets(roleIds, EXPECTED_AGENT_IDS)) {
    errors.push(`roles must be exactly the fixed set: ${EXPECTED_AGENT_IDS.join(", ")}.`);
  }
  if (manifest.roles.length !== EXPECTED_AGENT_IDS.length) {
    errors.push(`roles must contain ${EXPECTED_AGENT_IDS.length} entries.`);
  }

  const expectedAgentFiles = EXPECTED_AGENT_IDS.map((id) => `.claude/agents/${id}.md`);
  const actualAgentFiles = [...agentSources.keys()].sort();
  if (!compareSets(actualAgentFiles, expectedAgentFiles)) {
    errors.push(`.claude/agents must contain exactly: ${expectedAgentFiles.join(", ")}.`);
  }

  for (const role of manifest.roles) {
    const label = typeof role?.id === "string" ? role.id : "<unknown-role>";
    if (!role || typeof role !== "object" || Array.isArray(role)) {
      errors.push(`${label}: role entry must be an object.`);
      continue;
    }
    if (!EXPECTED_AGENT_IDS.includes(role.id)) errors.push(`${label}: unknown role ID.`);
    const expectedFile = `.claude/agents/${role.id}.md`;
    if (role.agentFile !== expectedFile) {
      errors.push(`${label}: agentFile must be ${expectedFile}.`);
    }
    if (typeof role.responsibility !== "string" || role.responsibility.trim().length < 20) {
      errors.push(`${label}: responsibility must be a substantive non-empty string.`);
    }

    const allowedTools = uniqueStrings(role.allowedTools, `${label}.allowedTools`, errors);
    for (const tool of allowedTools) {
      if (!toolCatalog.includes(tool)) errors.push(`${label}: unknown allowed tool ${tool}.`);
    }
    const forbiddenClasses = uniqueStrings(
      role.forbiddenToolClasses,
      `${label}.forbiddenToolClasses`,
      errors,
    );
    for (const toolClass of forbiddenClasses) {
      if (!forbiddenClassCatalog.includes(toolClass)) {
        errors.push(`${label}: unknown forbidden tool class ${toolClass}.`);
      }
    }

    const provider = role.provider ?? {};
    if (!providers.includes(provider.default)) {
      errors.push(`${label}: provider.default must reference providers.`);
    }
    const eligibleProviders = uniqueStrings(
      provider.eligible,
      `${label}.provider.eligible`,
      errors,
    );
    for (const eligible of eligibleProviders) {
      if (!providers.includes(eligible))
        errors.push(`${label}: unknown eligible provider ${eligible}.`);
    }
    if (!eligibleProviders.includes(provider.default)) {
      errors.push(`${label}: provider.default must be eligible.`);
    }
    if (typeof provider.claudeModelClass !== "string" || provider.claudeModelClass.trim() === "") {
      errors.push(`${label}: provider.claudeModelClass is required.`);
    }
    if (!ROUTING_STRATEGIES.includes(provider.routingStrategy)) {
      errors.push(`${label}: invalid provider.routingStrategy ${provider.routingStrategy}.`);
    }

    const execution = role.execution ?? {};
    if (!PERMISSION_MODES.includes(execution.permissionMode)) {
      errors.push(`${label}: invalid execution.permissionMode ${execution.permissionMode}.`);
    }
    if (!ISOLATION_MODES.includes(execution.isolation)) {
      errors.push(`${label}: invalid execution.isolation ${execution.isolation}.`);
    }
    if (!MEMORY_MODES.includes(execution.memory)) {
      errors.push(`${label}: invalid execution.memory ${execution.memory}.`);
    }

    const limits = role.limits ?? {};
    for (const key of ["maxContextTokens", "maxOutputTokens", "maxTurns"]) {
      if (!Number.isInteger(limits[key]) || limits[key] <= 0) {
        errors.push(`${label}: limits.${key} must be a positive integer.`);
      }
    }
    if (limits.maxOutputTokens >= limits.maxContextTokens) {
      errors.push(`${label}: maxOutputTokens must be lower than maxContextTokens.`);
    }

    uniqueStrings(role.requiredInputFields, `${label}.requiredInputFields`, errors);
    if (role.output?.format !== "markdown") {
      errors.push(`${label}: output.format must be markdown.`);
    }
    uniqueStrings(role.output?.requiredSections, `${label}.output.requiredSections`, errors);

    const handoffs = uniqueStrings(role.allowedHandoffs, `${label}.allowedHandoffs`, errors, {
      allowEmpty: true,
    });
    for (const destination of handoffs) {
      if (!roleIds.includes(destination)) errors.push(`${label}: unknown handoff ${destination}.`);
      if (destination === role.id) errors.push(`${label}: cannot hand off to itself.`);
    }

    const security = role.security ?? {};
    if (!DATA_CLASSIFICATIONS.includes(security.maxDataClassification)) {
      errors.push(`${label}: invalid security.maxDataClassification.`);
    }
    const approvals = uniqueStrings(
      security.approvalRequirements,
      `${label}.security.approvalRequirements`,
      errors,
      { allowEmpty: true },
    );
    for (const approval of approvals) {
      if (!approvalCatalog.includes(approval))
        errors.push(`${label}: unknown approval ${approval}.`);
    }

    const deterministicTests = uniqueStrings(
      role.deterministicTests,
      `${label}.deterministicTests`,
      errors,
    );
    for (const test of deterministicTests) {
      if (!deterministicTestCatalog.includes(test)) {
        errors.push(`${label}: unknown deterministic test ${test}.`);
      }
    }
    const liveEvals = uniqueStrings(role.liveEvalScenarios, `${label}.liveEvalScenarios`, errors);
    for (const scenario of liveEvals) {
      if (!liveEvalScenarioCatalog.includes(scenario)) {
        errors.push(`${label}: unknown live eval scenario ${scenario}.`);
      }
    }

    const source = agentSources.get(role.agentFile);
    if (!source) {
      errors.push(`${label}: agent source is missing at ${role.agentFile}.`);
      continue;
    }
    if (!/^[a-f0-9]{64}$/.test(role.sourceSha256 ?? "")) {
      errors.push(`${label}: sourceSha256 must be a lowercase SHA-256 digest.`);
    } else {
      const actualSourceSha256 = createHash("sha256").update(source).digest("hex");
      if (actualSourceSha256 !== role.sourceSha256) {
        errors.push(`${label}: source definition SHA-256 drift.`);
      }
    }
    let frontmatter;
    try {
      frontmatter = parseAgentFrontmatter(source, role.agentFile);
    } catch (error) {
      errors.push(String(error));
      continue;
    }
    if (frontmatter.name !== role.id) errors.push(`${label}: frontmatter name drift.`);
    const sourceTools = frontmatterTools(frontmatter.tools);
    if (!compareSets(sourceTools, allowedTools)) {
      errors.push(`${label}: frontmatter tools drift from allowedTools.`);
    }
    if (frontmatter.model !== provider.claudeModelClass) {
      errors.push(`${label}: frontmatter model drift from provider.claudeModelClass.`);
    }
    if (frontmatter.permissionMode !== execution.permissionMode) {
      errors.push(`${label}: frontmatter permissionMode drift.`);
    }
    if (frontmatter.maxTurns !== limits.maxTurns) {
      errors.push(`${label}: frontmatter maxTurns drift.`);
    }
    if ((frontmatter.isolation ?? "none") !== execution.isolation) {
      errors.push(`${label}: frontmatter isolation drift.`);
    }
    if ((frontmatter.memory ?? "none") !== execution.memory) {
      errors.push(`${label}: frontmatter memory drift.`);
    }
  }

  return errors;
}

export async function validateAgentContracts(root) {
  const inputs = await loadAgentContractInputs(root);
  return validateAgentContractData(inputs.manifest, inputs.agentSources);
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === modulePath) {
  const root = resolve(dirname(modulePath), "../..");
  const errors = await validateAgentContracts(root);
  if (errors.length) {
    console.error(`Agent contract validation failed with ${errors.length} issue(s):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(
    `Validated ${EXPECTED_AGENT_IDS.length} fixed agent contracts and source definitions.`,
  );
}
