import type { WorkRequest } from "../../domain/work-request.ts";
import type { RetrievedContextPackage } from "../../knowledge/context-packager.ts";

export function compileCodexPrompt(request: WorkRequest, context: RetrievedContextPackage): string {
  return [
    "Execute one bounded Beacon work unit from the current repository.",
    "",
    `Provider-neutral request: ${JSON.stringify(request, null, 2)}`,
    "",
    `Approved Markdoc context: ${JSON.stringify(context.approvedDocuments, null, 2)}`,
    `ADR constraints: ${JSON.stringify(context.adrConstraints, null, 2)}`,
    "",
    "Inspect before editing. Make only the approved change and run deterministic checks.",
    "Do not change acceptance criteria, self-approve, merge, push, deploy, or use production credentials.",
    "Return evidence, changed paths, risks, blockers, documentation impact, and the universal handoff.",
  ].join("\n");
}
