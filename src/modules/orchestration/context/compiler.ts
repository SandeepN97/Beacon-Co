import type { ContextPackage } from "../domain/context-package.ts";
import { PromptCompilationSchema, type PromptCompilation } from "../domain/prompt-compilation.ts";
import { sha256 } from "./preflight.ts";

export interface PromptCompilationInput {
  contextPackage: ContextPackage;
  objective: string;
}

export function compilePromptContext(input: PromptCompilationInput): PromptCompilation {
  const { contextPackage } = input;
  const stablePrefix = [
    "BEACON_AGENT_PLATFORM_V1",
    `ROLE=${contextPackage.agentRole}`,
    `CONTRACT_SHA256=${contextPackage.contractSha256}`,
    `ALLOWED_TOOLS=${contextPackage.allowedTools.join(",")}`,
    `ALLOWED_PATHS=${contextPackage.allowedPaths.join(",")}`,
    "INVARIANTS=least-privilege|preserve-exact-technical-data|reference-first|stop-at-required-approval",
  ].join("\n");

  const references = contextPackage.inventory.map((entry) => ({
    path: entry.path,
    sha256: entry.sha256,
    classification: entry.classification,
    content: entry.delivery === "embedded" ? entry.content : undefined,
    exactData: entry.exactData,
  }));
  const variableContext = [
    `OBJECTIVE\n${input.objective}`,
    `ACCEPTANCE_CRITERIA\n${contextPackage.acceptanceCriteria.join("\n")}`,
    `SEARCH_TERMS\n${contextPackage.searchTerms.join("\n")}`,
    `CONTEXT_REFERENCES\n${JSON.stringify(references, null, 2)}`,
  ].join("\n\n");
  const combined = `${stablePrefix}\n\n${variableContext}`;
  return PromptCompilationSchema.parse({
    schemaVersion: 1,
    contextPackageId: contextPackage.id,
    stablePrefix,
    variableContext,
    stablePrefixHash: sha256(stablePrefix),
    variableContextHash: sha256(variableContext),
    compilationHash: sha256(combined),
    totalBytes: Buffer.byteLength(combined, "utf8"),
    estimatedInputTokens: Math.ceil(Buffer.byteLength(combined, "utf8") / 4),
  });
}
