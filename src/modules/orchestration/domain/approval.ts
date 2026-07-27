export type ApprovalKind =
  | "architecture"
  | "spending"
  | "legal-privacy"
  | "production-change"
  | "merge"
  | "deployment"
  | "release"
  | "high-risk-interpretation";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface ApprovalRequest {
  id: string;
  workUnitId: string;
  kind: ApprovalKind;
  scope: string;
  requestedAt: string;
  status: ApprovalStatus;
  decidedAt: string | null;
  decidedBy: string | null;
  rationale: string | null;
}
