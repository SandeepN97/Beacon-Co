import type { WorkRequest } from "../../domain/work-request";
import type { ContextPackage } from "../../knowledge/context-packager";

export function compileClaudePrompt(request: WorkRequest, context: ContextPackage): string {
  return [
    "You are filling one bounded Beacon company role in a controlled workflow.",
    "",
    `Work request: ${JSON.stringify(request, null, 2)}`,
    "",
    `Approved Markdoc context: ${JSON.stringify(context.approvedDocuments, null, 2)}`,
    `ADR constraints: ${JSON.stringify(context.adrConstraints, null, 2)}`,
    "",
    "Preserve the approved goal and acceptance criteria. Stay within repository boundaries.",
    "Use evidence. Do not self-approve, merge, push, deploy, or alter business meaning.",
    "Stop at a blocker or required human gate and return the universal handoff.",
  ].join("\n");
}
