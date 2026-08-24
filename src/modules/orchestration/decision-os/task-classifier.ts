import { z } from "astro/zod";
import type { AgentRun } from "../domain/agent-run.ts";
import type { Risk } from "../domain/work-request.ts";
import {
  TaskClassSchema,
  WorkUnitTaskSignalsSchema,
  type TaskClass,
  type WorkUnit,
  type WorkUnitRole,
  type WorkUnitTaskSignals,
} from "../domain/work-unit.ts";
import { EventLog } from "./event-replay.ts";
import { KnowledgeEventSchema, type KnowledgeEvent } from "./events.ts";

/**
 * Section 29B.3's role-to-task-class table. `token-auditor` is excluded
 * from WorkUnitRole because its contract consumes the owning WorkUnit's
 * taskClass rather than defining a ninth mapping.
 */
const ROLE_TO_TASK_CLASS: Readonly<Record<WorkUnitRole, TaskClass>> = {
  "chief-of-staff": "architecture",
  "market-researcher": "research",
  "codebase-researcher": "codebase_discovery",
  "code-writer": "implementation",
  "qa-engineer": "qa",
  "pr-reviewer": "pr_review",
  "release-manager": "release",
};

const RISK_TIER_BY_REQUEST_RISK = {
  low: "risk-0",
  medium: "risk-1",
  high: "risk-2",
  critical: "risk-3",
} as const;

export function deriveWorkUnitTaskSignals(
  role: WorkUnitRole,
  risk: Risk,
  contextSize: number,
): WorkUnitTaskSignals {
  const riskTier = RISK_TIER_BY_REQUEST_RISK[risk];
  const permissionLevel = role === "code-writer" ? "controlled-worktree" : "plan-read-only";
  return WorkUnitTaskSignalsSchema.parse({
    role,
    riskTier,
    permissionLevel,
    independentReviewRequired: riskTier === "risk-2" || riskTier === "risk-3",
    contextSize,
    writeRequired: permissionLevel === "controlled-worktree",
  });
}

/**
 * Section 29B.2's pure rule-based classifier. It validates every structural
 * signal the WorkUnit carries and returns a label only. This module imports
 * no broker, router, or provider adapter and cannot select an executor.
 */
export function classifyTask(workUnit: WorkUnit): TaskClass {
  const signals = WorkUnitTaskSignalsSchema.parse({
    role: workUnit.role,
    riskTier: workUnit.riskTier,
    permissionLevel: workUnit.permissionLevel,
    independentReviewRequired: workUnit.independentReviewRequired,
    contextSize: workUnit.contextSize,
    writeRequired: workUnit.writeRequired,
  });
  const reviewRequired = signals.riskTier === "risk-2" || signals.riskTier === "risk-3";
  if (signals.riskTier !== RISK_TIER_BY_REQUEST_RISK[workUnit.risk]) {
    throw new Error(
      "Task Classifier signals are inconsistent: riskTier must match the WorkUnit risk classification.",
    );
  }
  if (signals.independentReviewRequired !== reviewRequired) {
    throw new Error(
      "Task Classifier signals are inconsistent: independent review is required exactly for riskTier 2-3.",
    );
  }
  if (signals.writeRequired !== (signals.permissionLevel === "controlled-worktree")) {
    throw new Error(
      "Task Classifier signals are inconsistent: writeRequired must match controlled-worktree permission.",
    );
  }
  return ROLE_TO_TASK_CLASS[signals.role];
}

export const TaskClassifiedPayloadSchema = z
  .object({
    workUnitId: z.string().min(1).max(160),
    taskClass: TaskClassSchema,
    classifierInput: WorkUnitTaskSignalsSchema,
  })
  .strict();
export type TaskClassifiedPayload = z.infer<typeof TaskClassifiedPayloadSchema>;

export const TaskClassifiedEventSchema = KnowledgeEventSchema(TaskClassifiedPayloadSchema).refine(
  (event) => event.eventType === "TaskClassified",
  {
    message: "TaskClassified events must use the TaskClassified event type.",
    path: ["eventType"],
  },
);
export type TaskClassifiedEvent = z.infer<typeof TaskClassifiedEventSchema>;

export interface TaskClassificationEventContext {
  eventId: string;
  projectRef: string;
  actorRef?: string;
  occurredAt?: string;
  projectContextRef?: string | null;
  causationRef?: string | null;
  correlationRef?: string | null;
}

export function createTaskClassifiedEvent(
  workUnit: WorkUnit,
  context: TaskClassificationEventContext,
): TaskClassifiedEvent {
  return TaskClassifiedEventSchema.parse({
    schemaVersion: 1,
    eventId: context.eventId,
    eventType: "TaskClassified",
    occurredAt: context.occurredAt ?? new Date().toISOString(),
    actorRef: context.actorRef ?? "task-classifier",
    projectRef: context.projectRef,
    visibility: "private",
    aggregateRef: workUnit.id,
    projectContextRef: context.projectContextRef ?? null,
    causationRef: context.causationRef ?? null,
    correlationRef: context.correlationRef ?? workUnit.id,
    payload: {
      workUnitId: workUnit.id,
      taskClass: classifyTask(workUnit),
      classifierInput: {
        role: workUnit.role,
        riskTier: workUnit.riskTier,
        permissionLevel: workUnit.permissionLevel,
        independentReviewRequired: workUnit.independentReviewRequired,
        contextSize: workUnit.contextSize,
        writeRequired: workUnit.writeRequired,
      },
    },
  });
}

/**
 * Minimal append-only log for the one event PR-0.6 is authorized to emit.
 * Deduplicates strictly on `eventId`, per PR-0B's Section 26A rules 1-2
 * ("eventId MUST be globally unique... nothing downstream may re-derive
 * identity from payload content") -- not on `workUnit.id`. A caller that
 * wants "one classification per WorkUnit, ever" gets that for free by
 * supplying a WorkUnit-derived eventId (as ../simulation.ts does:
 * `${workUnit.id}-task-classified`), but this log itself does not silently
 * discard a second, distinctly-eventId'd classification for the same
 * WorkUnit -- doing so would re-derive identity from the aggregate rather
 * than the event, which is exactly what rule 1 forbids.
 */
export class TaskClassificationEventLog {
  private readonly log = new EventLog<TaskClassifiedPayload>();
  private readonly byEventId = new Map<string, TaskClassifiedEvent>();

  record(workUnit: WorkUnit, context: TaskClassificationEventContext): TaskClassifiedEvent {
    const event = createTaskClassifiedEvent(workUnit, context);
    const isNewTransition = this.log.append(event as KnowledgeEvent<TaskClassifiedPayload>);
    if (isNewTransition) {
      this.byEventId.set(event.eventId, event);
      return event;
    }
    // Rule 2: "A duplicate delivery is a no-op, not an error and not a
    // second transition." Return the original event, not this candidate.
    return this.byEventId.get(event.eventId) ?? event;
  }

  all(): readonly KnowledgeEvent<TaskClassifiedPayload>[] {
    return this.log.all();
  }
}

export interface TaskClassProviderComparison {
  workUnitId: string;
  taskClass: TaskClass;
  actualProvider: AgentRun["provider"];
}

/** Observational join only; its result is never accepted by routing code. */
export function compareTaskClassToAgentRun(
  event: TaskClassifiedEvent,
  agentRun: AgentRun,
): TaskClassProviderComparison {
  if (event.payload.workUnitId !== agentRun.workUnitId) {
    throw new Error("TaskClassified event and AgentRun refer to different WorkUnits.");
  }
  return {
    workUnitId: agentRun.workUnitId,
    taskClass: event.payload.taskClass,
    actualProvider: agentRun.provider,
  };
}
