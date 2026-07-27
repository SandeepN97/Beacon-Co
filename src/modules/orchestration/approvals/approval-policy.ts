import type { ApprovalKind } from "../domain/approval";
import type { WorkRequest } from "../domain/work-request";

export function requiredApprovalKinds(request: WorkRequest): ApprovalKind[] {
  const requested = new Set(request.requiredApprovals as ApprovalKind[]);
  if (request.risk === "high" || request.risk === "critical") {
    requested.add("high-risk-interpretation");
  }
  if (request.workflowType === "architecture" && request.risk !== "low") {
    requested.add("architecture");
  }
  return [...requested];
}
