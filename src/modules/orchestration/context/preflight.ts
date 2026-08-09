import { createHash } from "node:crypto";
import type { AgentRiskClass, AgentRole } from "../domain/agent-run.ts";
import {
  ContextPackageSchema,
  type ContextInventoryEntry,
  type ContextPackage,
} from "../domain/context-package.ts";
import type { DataClassification } from "../domain/work-request.ts";

export interface ContextCandidate {
  path: string;
  content: string;
  classification: DataClassification;
  exactData?: boolean;
  mustEmbed?: boolean;
}

export interface ContextPreflightInput {
  workUnitId: string;
  objective: string;
  agentRole: AgentRole;
  riskClass: AgentRiskClass;
  contractSha256: string;
  maxContextTokens: number;
  allowedPaths: string[];
  allowedTools: string[];
  acceptanceCriteria: string[];
  searchTerms: string[];
  candidates: ContextCandidate[];
  routingAmbiguous?: boolean;
  previousContextBytes?: number;
  capacityOrFallback?: boolean;
}

const BYTES_PER_TOKEN = 4;
const DUPLICATION_THRESHOLD = 3;
const UNUSUAL_GROWTH_RATIO = 1.5;
const MAX_EMBEDDED_BYTES = 12_000;

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableUnique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export function runContextPreflight(input: ContextPreflightInput): ContextPackage {
  const sortedCandidates = [...input.candidates].sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      sha256(left.content).localeCompare(sha256(right.content)),
  );
  const seen = new Set<string>();
  const inventory: ContextInventoryEntry[] = [];
  let duplicatesRemoved = 0;
  let embeddedBytes = 0;

  for (const candidate of sortedCandidates) {
    const hash = sha256(candidate.content);
    const identity = `${candidate.path}:${hash}`;
    if (seen.has(identity)) {
      duplicatesRemoved += 1;
      continue;
    }
    seen.add(identity);
    const bytes = Buffer.byteLength(candidate.content, "utf8");
    const embed = Boolean(candidate.mustEmbed) && embeddedBytes + bytes <= MAX_EMBEDDED_BYTES;
    if (embed) embeddedBytes += bytes;
    inventory.push({
      path: candidate.path,
      sha256: hash,
      bytes,
      classification: candidate.classification,
      delivery: embed ? "embedded" : "reference",
      exactData: Boolean(candidate.exactData),
      content: embed ? candidate.content : null,
    });
  }

  const allowedPaths = stableUnique(input.allowedPaths);
  const allowedTools = stableUnique(input.allowedTools);
  const acceptanceCriteria = stableUnique(input.acceptanceCriteria);
  const searchTerms = stableUnique(input.searchTerms);
  const stablePrefixMaterial = JSON.stringify({
    platform: "beacon-agent-platform-v1",
    role: input.agentRole,
    contractSha256: input.contractSha256,
    allowedTools,
    allowedPaths,
    invariants: [
      "least-privilege",
      "preserve-exact-technical-data",
      "reference-first",
      "stop-at-required-approval",
    ],
  });
  const variableMaterial = JSON.stringify({
    objective: input.objective,
    acceptanceCriteria,
    searchTerms,
    inventory,
  });
  const contextBytes = Buffer.byteLength(stablePrefixMaterial + variableMaterial, "utf8");
  const estimatedInputTokens = Math.ceil(contextBytes / BYTES_PER_TOKEN);
  const reasons: ContextPackage["tokenAuditor"]["reasons"] = [];
  if (estimatedInputTokens > input.maxContextTokens) reasons.push("budget-breach");
  if (duplicatesRemoved >= DUPLICATION_THRESHOLD) reasons.push("significant-duplication");
  if (input.routingAmbiguous) reasons.push("routing-ambiguity");
  if (
    input.previousContextBytes !== undefined &&
    contextBytes > input.previousContextBytes * UNUSUAL_GROWTH_RATIO
  ) {
    reasons.push("unusual-context-growth");
  }
  if (input.capacityOrFallback) reasons.push("capacity-or-fallback");

  const taskFingerprint = sha256(
    JSON.stringify({ objective: input.objective, acceptanceCriteria, agentRole: input.agentRole }),
  );
  return ContextPackageSchema.parse({
    schemaVersion: 1,
    id: `context-${taskFingerprint.slice(0, 24)}`,
    workUnitId: input.workUnitId,
    taskFingerprint,
    agentRole: input.agentRole,
    riskClass: input.riskClass,
    contractSha256: input.contractSha256,
    allowedPaths,
    allowedTools,
    acceptanceCriteria,
    searchTerms,
    inventory,
    contextBytes,
    estimatedInputTokens,
    maxContextTokens: input.maxContextTokens,
    budgetStatus: estimatedInputTokens > input.maxContextTokens ? "over-budget" : "within-budget",
    duplicatesRemoved,
    stablePrefixHash: sha256(stablePrefixMaterial),
    variableContextHash: sha256(variableMaterial),
    tokenAuditor: { required: reasons.length > 0, reasons },
  });
}
