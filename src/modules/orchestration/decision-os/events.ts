import { z } from "astro/zod";
import { EventVisibilitySchema } from "./visibility.ts";

/**
 * Section 26's event vocabulary, grouped by lifecycle area exactly as the spec table
 * groups them. PR-0 defines the envelope and this closed vocabulary only; per-event
 * payload schemas are added as each later PR implements the event it actually emits
 * (Section 35.1 point 4: "Implement typed contracts and event lineage before rich
 * UI" -- the lineage/vocabulary comes first, one payload at a time after).
 */
export const KnowledgeEventTypeSchema = z.enum([
  // Thought
  "PromptObserved",
  "ThoughtClassified",
  "ResearchThreadCreated",
  "ResearchThreadUpdated",
  // Research
  "QuestionFormalized",
  "QuestionAdded",
  "ProjectContextAttached",
  "ResearchPlanCreated",
  "ResearchStarted",
  "SourceFound",
  "SourceEvaluated",
  "EvidenceAdded",
  "EvidenceContradicted",
  // Understanding
  "ClaimCreated",
  "ClaimStatusChanged",
  "AlternativeAdded",
  "ExperimentProposed",
  "ExperimentCompleted",
  "MentalModelSelected",
  "VisualGenerated",
  "UnderstandingVersionCreated",
  // Decision
  "DecisionReadinessUpdated",
  "DecisionCandidateCreated",
  "DecisionAccepted",
  "DecisionRejected",
  "ADRRequested",
  "ADRAccepted",
  "ArchitectureImpactCalculated",
  "DocumentationImpactCalculated",
  "DecisionPackageCreated",
  // Execution feedback
  "WorkUnitCreated",
  "AgentRunStarted",
  "AgentRunCompleted",
  "QAPassed",
  "ReviewCompleted",
  "CouncilCompleted",
  "CIPassed",
  "ReleaseVerified",
  "OutcomeObserved",
  "RetrospectiveCreated",
  "ContinuationPackageGenerated",
  "ContinuationPackageStale",
  // Provider continuity (new lifecycle area in V5)
  "ProviderCapacityWarning",
  "ProviderSwitchTriggered",
  "ProviderSwitchCompleted",
  "BothProvidersUnavailable",
  // Narrative
  "StoryCandidateCreated",
  "StoryPublished",
]);
export type KnowledgeEventType = z.infer<typeof KnowledgeEventTypeSchema>;

const TimestampSchema = z.iso.datetime({ offset: true });
const RefSchema = z.string().min(1).max(160);

/**
 * Section 26's `KnowledgeEvent<T>` envelope, generic over payload shape. `visibility`
 * defaults to `"private"` per Section 5/27's private-by-default rule -- see
 * ./authority.ts for the same default applied outside a schema-parse context.
 */
export function KnowledgeEventSchema<PayloadSchema extends z.ZodTypeAny>(
  payloadSchema: PayloadSchema,
) {
  return z
    .object({
      schemaVersion: z.literal(1),
      eventId: RefSchema,
      eventType: KnowledgeEventTypeSchema,
      occurredAt: TimestampSchema,
      actorRef: RefSchema,
      projectRef: RefSchema,
      visibility: EventVisibilitySchema.default("private"),
      aggregateRef: RefSchema,
      projectContextRef: RefSchema.nullable(),
      causationRef: RefSchema.nullable(),
      correlationRef: RefSchema.nullable(),
      payload: payloadSchema,
    })
    .strict();
}

export type KnowledgeEvent<Payload> = {
  schemaVersion: 1;
  eventId: string;
  eventType: KnowledgeEventType;
  occurredAt: string;
  actorRef: string;
  projectRef: string;
  visibility: EventVisibilitySchema["_output"];
  aggregateRef: string;
  projectContextRef: string | null;
  causationRef: string | null;
  correlationRef: string | null;
  payload: Payload;
};

export function validateKnowledgeEvent<PayloadSchema extends z.ZodTypeAny>(
  payloadSchema: PayloadSchema,
  input: unknown,
): z.infer<ReturnType<typeof KnowledgeEventSchema<PayloadSchema>>> {
  return KnowledgeEventSchema(payloadSchema).parse(input);
}
