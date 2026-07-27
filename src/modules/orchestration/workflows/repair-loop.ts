export interface RepairState {
  attempt: number;
  maximumAttempts: number;
  ownerRole: string;
  evidence: string[];
}

export function requestRepair(state: RepairState, defectEvidence: string): RepairState {
  if (state.attempt >= state.maximumAttempts) {
    throw new Error("Bounded repair limit reached; human escalation is required.");
  }
  return {
    ...state,
    attempt: state.attempt + 1,
    evidence: [...state.evidence, defectEvidence],
  };
}
