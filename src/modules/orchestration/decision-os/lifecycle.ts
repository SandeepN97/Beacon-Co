import { z } from "astro/zod";

/**
 * Section 25A's Lifecycle State Machines, encoded as transition guards, per
 * PR-0A's bound in ADR-0021 ("Lifecycle State Machines (25A) encoded as
 * transition guards"). Each status enum and transition set below is taken
 * directly from this repo's live `.mmd` diagram sources under
 * public/diagrams/mermaid/ -- see decision-os-contract-consistency.test.ts
 * for the automated check that keeps the ADR and LearningPackage enums here
 * in sync with those sources and with Appendix A's inline enums (the two
 * places Appendix A states an explicit status enum).
 *
 * SCOPE NOTE, found while building this against the live spec: three of
 * this repo's existing PR-0 domain schemas (predating Section 25A, which
 * landed in V6.5 after PR-0 was already merged) use a different status
 * vocabulary than the diagrams below:
 *   - decision.ts's AdrRefSchema.status: "requested" | "accepted" |
 *     "superseded" (no "deprecated") vs. this file's ADR lifecycle:
 *     proposed | accepted | deprecated | superseded (matching Appendix A's
 *     ADRRef.status exactly).
 *   - research-thread.ts's ResearchThreadStatusSchema: "open" | "active" |
 *     "paused" | "decision-ready" | "closed" vs. this file's ResearchThread
 *     lifecycle: captured | formalized | researching | synthesized |
 *     decision-ready | decided | reopened.
 *   - understanding.ts's UnderstandingVersionSchema has no status field at
 *     all yet, vs. this file's UnderstandingVersion lifecycle: draft |
 *     evaluated | current | superseded.
 * ADR-0021 authorizes encoding Section 25A's diagrams as guards, not
 * reconciling them with pre-existing PR-0 schemas -- that reconciliation is
 * explicitly out of scope here. It is a real, open finding, reported as
 * such rather than silently fixed or silently ignored.
 */

// --- ADR lifecycle (public/diagrams/mermaid/phase-1-6-adr-lifecycle.mmd) ---

export const AdrLifecycleStatusSchema = z.enum([
  "proposed",
  "accepted",
  "deprecated",
  "superseded",
]);
export type AdrLifecycleStatus = z.infer<typeof AdrLifecycleStatusSchema>;

const ADR_TRANSITIONS: Record<AdrLifecycleStatus, readonly AdrLifecycleStatus[]> = {
  proposed: ["accepted"],
  accepted: ["deprecated", "superseded"],
  deprecated: [],
  superseded: [],
};

function assertTransition<Status extends string>(
  transitions: Record<Status, readonly Status[]>,
  entityName: string,
  from: Status,
  to: Status,
): void {
  const allowed = transitions[from];
  if (!allowed.includes(to)) {
    throw new Error(
      `illegal ${entityName} lifecycle transition: "${from}" -> "${to}" is not permitted (Section 25A; allowed from "${from}": ${
        allowed.length > 0 ? allowed.join(", ") : "none, terminal state"
      })`,
    );
  }
}

/**
 * INV-003's enforcement point: "An accepted ADR MUST NOT be mutated" means,
 * concretely, there is no accepted -> accepted transition in this state
 * machine at all -- editing an accepted ADR is not a recognized transition,
 * only superseding or deprecating it is (Figure 10D's caption: "ACCEPTED is
 * immutable per INV-003 -- there is no ACCEPTED-to-ACCEPTED edit
 * transition").
 */
export function assertValidAdrTransition(from: AdrLifecycleStatus, to: AdrLifecycleStatus): void {
  assertTransition(ADR_TRANSITIONS, "ADR", from, to);
}

// --- LearningPackage lifecycle (.../phase-1-6-learning-package-lifecycle.mmd) ---

export const LearningPackageLifecycleStatusSchema = z.enum([
  "draft",
  "evaluating",
  "trusted",
  "historical",
]);
export type LearningPackageLifecycleStatus = z.infer<typeof LearningPackageLifecycleStatusSchema>;

const LEARNING_PACKAGE_TRANSITIONS: Record<
  LearningPackageLifecycleStatus,
  readonly LearningPackageLifecycleStatus[]
> = {
  draft: ["evaluating"],
  evaluating: ["trusted"],
  trusted: ["historical"],
  historical: [],
};

export function assertValidLearningPackageTransition(
  from: LearningPackageLifecycleStatus,
  to: LearningPackageLifecycleStatus,
): void {
  assertTransition(LEARNING_PACKAGE_TRANSITIONS, "LearningPackage", from, to);
}

// --- ResearchThread lifecycle (.../phase-1-6-research-thread-lifecycle.mmd) ---

export const ResearchThreadLifecycleStatusSchema = z.enum([
  "captured",
  "formalized",
  "researching",
  "synthesized",
  "decision-ready",
  "decided",
  "reopened",
]);
export type ResearchThreadLifecycleStatus = z.infer<typeof ResearchThreadLifecycleStatusSchema>;

const RESEARCH_THREAD_TRANSITIONS: Record<
  ResearchThreadLifecycleStatus,
  readonly ResearchThreadLifecycleStatus[]
> = {
  captured: ["formalized"],
  formalized: ["researching"],
  researching: ["synthesized"],
  synthesized: ["decision-ready"],
  "decision-ready": ["decided"],
  decided: ["reopened"],
  reopened: ["researching"],
};

export function assertValidResearchThreadTransition(
  from: ResearchThreadLifecycleStatus,
  to: ResearchThreadLifecycleStatus,
): void {
  assertTransition(RESEARCH_THREAD_TRANSITIONS, "ResearchThread", from, to);
}

// --- UnderstandingVersion lifecycle (.../phase-1-6-understanding-version-lifecycle.mmd) ---

export const UnderstandingVersionLifecycleStatusSchema = z.enum([
  "draft",
  "evaluated",
  "current",
  "superseded",
]);
export type UnderstandingVersionLifecycleStatus = z.infer<
  typeof UnderstandingVersionLifecycleStatusSchema
>;

const UNDERSTANDING_VERSION_TRANSITIONS: Record<
  UnderstandingVersionLifecycleStatus,
  readonly UnderstandingVersionLifecycleStatus[]
> = {
  draft: ["evaluated"],
  evaluated: ["current"],
  current: ["superseded"],
  superseded: [],
};

/**
 * INV-005's future enforcement point (not activated in PR-0A -- INV-005
 * activates in PR-3 per Section 31's table, once UnderstandingVersion is a
 * real, populated entity): superseding never deletes the prior version's
 * addressability, it only ever appends a `current -> superseded` transition
 * on the OLD version while a new one is created independently.
 */
export function assertValidUnderstandingVersionTransition(
  from: UnderstandingVersionLifecycleStatus,
  to: UnderstandingVersionLifecycleStatus,
): void {
  assertTransition(UNDERSTANDING_VERSION_TRANSITIONS, "UnderstandingVersion", from, to);
}

// --- DecisionCandidate lifecycle (.../phase-1-6-decision-candidate-lifecycle.mmd) ---

export const DecisionCandidateLifecycleStatusSchema = z.enum([
  "draft",
  "researching",
  "ready",
  "accepted",
  "rejected",
]);
export type DecisionCandidateLifecycleStatus = z.infer<
  typeof DecisionCandidateLifecycleStatusSchema
>;

const DECISION_CANDIDATE_TRANSITIONS: Record<
  DecisionCandidateLifecycleStatus,
  readonly DecisionCandidateLifecycleStatus[]
> = {
  draft: ["researching"],
  researching: ["ready"],
  ready: ["accepted", "rejected"],
  accepted: [],
  rejected: [],
};

export function assertValidDecisionCandidateTransition(
  from: DecisionCandidateLifecycleStatus,
  to: DecisionCandidateLifecycleStatus,
): void {
  assertTransition(DECISION_CANDIDATE_TRANSITIONS, "DecisionCandidate", from, to);
}
