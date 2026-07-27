import type { ProviderId } from "./provider";
import type { Risk, WorkRequest } from "./work-request";

export type WorkUnitStatus =
  | "draft"
  | "waiting-for-context"
  | "ready"
  | "routed"
  | "simulating"
  | "waiting-for-approval"
  | "review"
  | "repair"
  | "complete"
  | "blocked";

export interface WorkUnit {
  id: string;
  request: WorkRequest;
  goal: string;
  acceptanceCriteria: string[];
  constraints: string[];
  risk: Risk;
  dependencies: string[];
  status: WorkUnitStatus;
  assignedProvider: ProviderId | null;
  authorSessionId: string | null;
  retryCount: number;
}

export interface ContinuationPackage {
  workUnit: WorkUnit;
  originalUserRequest: string;
  normalizedGoal: string;
  approvedMarkdocContext: string[];
  acceptedAdrConstraints: string[];
  filesInspected: string[];
  filesChanged: string[];
  currentDiff: string;
  commandsRun: string[];
  testEvidence: string[];
  decisionsMade: string[];
  assumptions: string[];
  openBlockers: string[];
  requiredNextAction: string;
  stopCondition: string;
}
