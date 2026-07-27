import type { QualityGateResult } from "../domain/evidence";
import { deterministicGatesPass } from "./quality-gates";

export interface ReviewVote {
  reviewerId: string;
  provider: "claude" | "codex";
  sessionId: string;
  approved: boolean;
  blockers: string[];
  acceptanceEvidence: string[];
}

export interface CompletionInput {
  gates: QualityGateResult[];
  votes: ReviewVote[];
  authorSessionId: string;
  unresolvedBlockers: string[];
  acceptanceCriteriaCount: number;
  requiredApprovalsComplete: boolean;
}

export function mayComplete(input: CompletionInput): boolean {
  const seenSessions = new Set<string>();
  const independentVotes = input.votes.filter(({ sessionId }) => {
    if (sessionId === input.authorSessionId || seenSessions.has(sessionId)) {
      return false;
    }
    seenSessions.add(sessionId);
    return true;
  });
  const approvals = independentVotes.filter(
    ({ approved, blockers }) => approved && blockers.length === 0,
  ).length;
  const acceptanceEvidence = new Set(
    independentVotes.flatMap(({ acceptanceEvidence: evidence }) => evidence),
  );

  return (
    deterministicGatesPass(input.gates) &&
    approvals >= 2 &&
    input.unresolvedBlockers.length === 0 &&
    acceptanceEvidence.size >= input.acceptanceCriteriaCount &&
    input.requiredApprovalsComplete
  );
}
