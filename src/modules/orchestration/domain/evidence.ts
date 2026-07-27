export type EvidenceKind =
  | "command"
  | "test"
  | "file"
  | "decision"
  | "review"
  | "approval";

export interface EvidenceRecord {
  id: string;
  workUnitId: string;
  kind: EvidenceKind;
  summary: string;
  source: string;
  recordedAt: string;
  passed?: boolean;
}

export interface QualityGateResult {
  name: string;
  passed: boolean;
  evidence: string;
  blocking: boolean;
}
