import { z } from "astro/zod";
import { EventVisibilitySchema } from "./visibility.ts";
import {
  AlternativeIdSchema,
  ClaimIdSchema,
  DecisionCandidateIdSchema,
  DecisionPackageIdSchema,
  EvidenceIdSchema,
  ExperimentIdSchema,
  ProjectContextSnapshotIdSchema,
  PromptObservedIdSchema,
  QuestionIdSchema,
  ResearchThreadIdSchema,
  SourceIdSchema,
  UnderstandingVersionIdSchema,
} from "./ids.ts";

/** Section 7's question types: the seven lenses a Research Thread decomposes into. */
export const QuestionTypeSchema = z.enum([
  "core",
  "current-state",
  "mechanism",
  "alternative",
  "evidence",
  "boundary",
  "decision",
]);
export type QuestionType = z.infer<typeof QuestionTypeSchema>;

export const QuestionSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: QuestionIdSchema,
    threadId: ResearchThreadIdSchema,
    type: QuestionTypeSchema,
    text: z.string().min(1).max(2000),
    unknowns: z.array(z.string().min(1).max(1000)).max(50),
    decisionRelevance: z.string().min(1).max(1000).nullable(),
  })
  .strict();
export type Question = z.infer<typeof QuestionSchema>;

export const ResearchThreadStatusSchema = z.enum([
  "open",
  "active",
  "paused",
  "decision-ready",
  "closed",
]);
export type ResearchThreadStatus = z.infer<typeof ResearchThreadStatusSchema>;

/**
 * Appendix A's ResearchThread contract: "the durable container for one meaningful
 * question" (Section 7). `visibility` defaults to `"private"` per Section 5
 * ("Capture each submitted terminal thought as a private-by-default PromptObserved
 * event") -- callers must widen it explicitly, never by omission.
 */
export const ResearchThreadSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: ResearchThreadIdSchema,
    title: z.string().min(1).max(200),
    originalThoughtRef: PromptObservedIdSchema,
    formalizedQuestion: z.string().min(1).max(2000).nullable(),
    status: ResearchThreadStatusSchema,
    visibility: EventVisibilitySchema.default("private"),
    projectContextSnapshotRef: ProjectContextSnapshotIdSchema.nullable(),
    questionRefs: z.array(QuestionIdSchema).max(200),
    sourceRefs: z.array(SourceIdSchema).max(500),
    evidenceRefs: z.array(EvidenceIdSchema).max(500),
    claimRefs: z.array(ClaimIdSchema).max(500),
    alternativeRefs: z.array(AlternativeIdSchema).max(100),
    experimentRefs: z.array(ExperimentIdSchema).max(100),
    understandingVersionRefs: z.array(UnderstandingVersionIdSchema).max(100),
    decisionCandidateRef: DecisionCandidateIdSchema.nullable(),
    acceptedAdrRef: z
      .string()
      .regex(/^\d{4}-[a-z0-9-]+$/, "must match the decisions/ ADR slug convention")
      .nullable(),
    decisionPackageRef: DecisionPackageIdSchema.nullable(),
    executionRefs: z.array(z.string().min(1).max(160)).max(200),
    outcomeRefs: z.array(z.string().min(1).max(160)).max(200),
  })
  .strict();
export type ResearchThread = z.infer<typeof ResearchThreadSchema>;

export function validateResearchThread(input: unknown): ResearchThread {
  return ResearchThreadSchema.parse(input);
}

export function validateQuestion(input: unknown): Question {
  return QuestionSchema.parse(input);
}
