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

export type ReadinessTier = "local" | "publication" | "external";

export interface ContinuationGate {
  name: string;
  tier: ReadinessTier;
  candidateShaBound: boolean;
}

export interface ContinuationEvidenceReference {
  id: string;
  gate: string;
  candidateSha: string | null;
}

export interface PublicationContinuationState {
  localReady: boolean;
  publicationReady: boolean;
  externalReady: boolean;
  requiredGates: ContinuationGate[];
  completedGates: string[];
  failedGates: string[];
  outstandingGates: string[];
  evidenceRefs: ContinuationEvidenceReference[];
  branch: string;
  candidateSha: string;
  prNumber: number | null;
  nextAuthorizedAction: string;
}

export interface ContinuationPackage {
  workUnit: WorkUnit;
  originalUserRequest: string;
  normalizedGoal: string;
  approvedMarkdocContext: string[];
  acceptedAdrConstraints: string[];
  filesInspected: string[];
  filesChanged: string[];
  currentDiffRef: string;
  commandsRun: string[];
  testEvidence: string[];
  decisionsMade: string[];
  assumptions: string[];
  openBlockers: string[];
  requiredNextAction: string;
  stopCondition: string;
  publicationState: PublicationContinuationState;
}
