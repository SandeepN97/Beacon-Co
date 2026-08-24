import { z } from "astro/zod";
import { AgentRiskClassSchema, AgentRoleSchema } from "./agent-run.ts";
import type { ProviderId } from "./provider";
import type { Risk, WorkRequest } from "./work-request";

/** Section 29B.2's closed task-class vocabulary. */
export const TaskClassSchema = z.enum([
  "architecture",
  "research",
  "codebase_discovery",
  "implementation",
  "qa",
  "pr_review",
  "release",
  "learning_explanation",
]);
export type TaskClass = z.infer<typeof TaskClassSchema>;

export const TaskPermissionLevelSchema = z.enum(["plan-read-only", "controlled-worktree"]);
export type TaskPermissionLevel = z.infer<typeof TaskPermissionLevelSchema>;

/**
 * `token-auditor` consumes a taskClass when auditing another task; it does
 * not own a task class in Section 29B.3's role table. It therefore cannot
 * be the execution role of a classifiable WorkUnit.
 */
export const WorkUnitRoleSchema = AgentRoleSchema.exclude(["token-auditor"]);
export type WorkUnitRole = z.infer<typeof WorkUnitRoleSchema>;

export const WorkUnitTaskSignalsSchema = z
  .object({
    role: WorkUnitRoleSchema,
    riskTier: AgentRiskClassSchema,
    permissionLevel: TaskPermissionLevelSchema,
    independentReviewRequired: z.boolean(),
    contextSize: z.number().int().nonnegative(),
    writeRequired: z.boolean(),
  })
  .strict();
export type WorkUnitTaskSignals = z.infer<typeof WorkUnitTaskSignalsSchema>;

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

export interface WorkUnit extends WorkUnitTaskSignals {
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
