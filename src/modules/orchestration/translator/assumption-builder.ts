import type { WorkflowType } from "../domain/work-request";

export function buildAssumptions(
  rawRequest: string,
  workflowType: WorkflowType,
): string[] {
  const assumptions = [
    "Work stays inside the current Beacon-Co repository.",
    "No deployment, merge, push, or production credential use is authorized.",
  ];

  if (!/\b(deadline|today|tomorrow|by \w+day|date)\b/i.test(rawRequest)) {
    assumptions.push("No delivery date is assumed.");
  }
  if (!/\b(budget|\$|cost|spend)\b/i.test(rawRequest)) {
    assumptions.push("No spending authority is assumed.");
  }
  if (workflowType === "implementation") {
    assumptions.push("Use the smallest change consistent with approved architecture and existing conventions.");
  }
  if (workflowType === "documentation") {
    assumptions.push("Approved Markdoc remains canonical; source proposals stay labeled as proposals.");
  }
  return assumptions;
}
