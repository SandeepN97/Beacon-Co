import { AdrRefSchema, type AdrRef } from "./decision.ts";
import { EventVisibilitySchema, type EventVisibility } from "./visibility.ts";

/**
 * Section 19's authority invariant, enforced in code rather than left as a
 * review-only guideline: "Research != authorization. Evidence != authorization.
 * Concept != authorization. Diagram != authorization. Recommendation != authorization.
 * Decision Candidate != authorization. Only an accepted ADR authorizes execution."
 *
 * The only input this accepts is a real AdrRef (validated against AdrRefSchema
 * from ./decision.ts -- reused, not duplicated) whose `status` is exactly
 * "accepted". A DecisionCandidate disposed "accept" (however satisfied its
 * readiness), a "requested" or "superseded" AdrRef, or any other object --
 * however confident-looking -- is rejected. Any code path that gates real
 * Phase 1.6 execution against ADR authority calls this, not an ad hoc status
 * check, so the boundary lives in exactly one place.
 */
export function assertExecutionAuthorized(candidate: unknown): AdrRef {
  const adrRef = AdrRefSchema.parse(candidate);
  if (adrRef.status !== "accepted") {
    throw new Error(
      `execution is not authorized: ADR ${adrRef.adrId} has status "${adrRef.status}", not "accepted" (Section 19 authority invariant -- only an accepted ADR authorizes execution)`,
    );
  }
  return adrRef;
}

/**
 * Section 24/27's "private by default" rule, applied outside a schema-parse
 * context. The schemas that hold a `visibility` field (research-thread.ts,
 * events.ts) already apply `.default("private")` at parse time; this function
 * is for code paths that resolve a visibility value before or without going
 * through `.parse()` -- e.g. deciding what visibility a new event should
 * carry while assembling it, prior to validation.
 *
 * An explicit value (including an explicit "private") is always honored
 * verbatim, once validated; only a missing value (`null`/`undefined`)
 * defaults to "private". Widening visibility is always an explicit caller
 * decision, never something that happens by omission.
 */
export function defaultToPrivateVisibility(explicit?: unknown): EventVisibility {
  if (explicit === null || explicit === undefined) return "private";
  return EventVisibilitySchema.parse(explicit);
}
