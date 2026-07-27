import type { ApprovalRequest } from "../domain/approval";

export class ApprovalStore {
  private readonly records = new Map<string, ApprovalRequest>();

  save(request: ApprovalRequest): ApprovalRequest {
    this.records.set(request.id, request);
    return request;
  }

  get(id: string): ApprovalRequest | undefined {
    return this.records.get(id);
  }

  forWorkUnit(workUnitId: string): ApprovalRequest[] {
    return [...this.records.values()].filter((record) => record.workUnitId === workUnitId);
  }
}
