import type { ApprovalKind, ApprovalRequest } from "../domain/approval";
import { ApprovalStore } from "./approval-store";

export class ApprovalManager {
  constructor(private readonly store = new ApprovalStore()) {}

  request(workUnitId: string, kind: ApprovalKind, scope: string): ApprovalRequest {
    return this.store.save({
      id: `${workUnitId}-${kind}`,
      workUnitId,
      kind,
      scope,
      requestedAt: new Date().toISOString(),
      status: "pending",
      decidedAt: null,
      decidedBy: null,
      rationale: null,
    });
  }

  decide(
    id: string,
    decision: "approved" | "rejected",
    decidedBy: string,
    rationale: string,
  ): ApprovalRequest {
    const record = this.store.get(id);
    if (!record) throw new Error(`Approval request not found: ${id}`);
    return this.store.save({
      ...record,
      status: decision,
      decidedAt: new Date().toISOString(),
      decidedBy,
      rationale,
    });
  }

  allRequiredApproved(workUnitId: string): boolean {
    const records = this.store.forWorkUnit(workUnitId);
    return records.length === 0 || records.every(({ status }) => status === "approved");
  }
}
