import { z } from "astro/zod";

/**
 * Typed IDs for the Phase 1.6 Knowledge/Research/Understanding/Decision domain
 * (plans/phase-1-6-master-spec.mdoc, Appendix A and Section 25.1's minimum canonical
 * entities). Each entity gets its own branded string type so, for example, a
 * `ClaimId` cannot be passed where a `SourceId` is expected, even though both are
 * plain strings at runtime -- the brand only exists at the type level.
 *
 * This repository's existing Phase 1.5 domain types (src/modules/orchestration/domain)
 * use plain bounded strings for IDs without nominal branding. PR-0 introduces branding
 * only for the new Phase 1.6 entities, using zod's built-in `.brand()` rather than a
 * bespoke pattern, so it stays a small, idiomatic addition instead of a second,
 * unrelated typing convention.
 */

const idString = () => z.string().min(1).max(160);

export const PromptObservedIdSchema = idString().brand<"PromptObservedId">();
export type PromptObservedId = z.infer<typeof PromptObservedIdSchema>;

export const ResearchThreadIdSchema = idString().brand<"ResearchThreadId">();
export type ResearchThreadId = z.infer<typeof ResearchThreadIdSchema>;

export const QuestionIdSchema = idString().brand<"QuestionId">();
export type QuestionId = z.infer<typeof QuestionIdSchema>;

export const ProjectContextSnapshotIdSchema = idString().brand<"ProjectContextSnapshotId">();
export type ProjectContextSnapshotId = z.infer<typeof ProjectContextSnapshotIdSchema>;

export const SourceIdSchema = idString().brand<"SourceId">();
export type SourceId = z.infer<typeof SourceIdSchema>;

export const EvidenceIdSchema = idString().brand<"EvidenceId">();
export type EvidenceId = z.infer<typeof EvidenceIdSchema>;

export const ClaimIdSchema = idString().brand<"ClaimId">();
export type ClaimId = z.infer<typeof ClaimIdSchema>;

export const UnderstandingVersionIdSchema = idString().brand<"UnderstandingVersionId">();
export type UnderstandingVersionId = z.infer<typeof UnderstandingVersionIdSchema>;

export const MentalModelIdSchema = idString().brand<"MentalModelId">();
export type MentalModelId = z.infer<typeof MentalModelIdSchema>;

export const UnderstandingCheckIdSchema = idString().brand<"UnderstandingCheckId">();
export type UnderstandingCheckId = z.infer<typeof UnderstandingCheckIdSchema>;

export const AlternativeIdSchema = idString().brand<"AlternativeId">();
export type AlternativeId = z.infer<typeof AlternativeIdSchema>;

export const ExperimentIdSchema = idString().brand<"ExperimentId">();
export type ExperimentId = z.infer<typeof ExperimentIdSchema>;

export const DecisionCandidateIdSchema = idString().brand<"DecisionCandidateId">();
export type DecisionCandidateId = z.infer<typeof DecisionCandidateIdSchema>;

export const DecisionPackageIdSchema = idString().brand<"DecisionPackageId">();
export type DecisionPackageId = z.infer<typeof DecisionPackageIdSchema>;

export const KnowledgeEventIdSchema = idString().brand<"KnowledgeEventId">();
export type KnowledgeEventId = z.infer<typeof KnowledgeEventIdSchema>;
