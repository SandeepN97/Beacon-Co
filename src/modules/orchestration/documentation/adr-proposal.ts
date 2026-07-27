import type { WorkRequest } from "../domain/work-request";

export interface AdrProposal {
  title: string;
  status: "draft";
  context: string;
  decisionNeeded: string;
  sourceRequestId: string;
}

export function createAdrProposal(request: WorkRequest): AdrProposal {
  return {
    title: `Decide: ${request.normalizedGoal}`,
    status: "draft",
    context: request.businessOutcome,
    decisionNeeded: "An authorized human must accept, reject, or revise this proposed decision.",
    sourceRequestId: request.id,
  };
}
