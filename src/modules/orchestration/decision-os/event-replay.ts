import type { KnowledgeEvent } from "./events.ts";

/**
 * Section 26A's Event and Replay Semantics, encoded as the actual
 * mechanism, per PR-0B's bound in ADR-0021
 * (src/content/docs/decisions/0021-authorize-pr-0a-and-pr-0b-as-bounded-increments.mdoc):
 * eventId-based idempotency (rules 1-2 below), causationRef/correlationRef
 * enforcement (rules 3-4), and replay capability for derived state (rule
 * 5). No new canonical entity is introduced here, and nothing in this file
 * changes execution-control or routing behavior -- it is a pure, in-memory
 * read-side mechanism over `KnowledgeEvent`s that already exist per
 * events.ts.
 *
 * `AggregateActivityProjection` below is a deliberately minimal, generic
 * derived-state shape used only to exercise and prove the replay
 * mechanism -- it is infrastructure for Section 26A's own acceptance test
 * ("a fixture that deletes a derived projection and confirms replay
 * reconstructs it byte-for-byte equivalent"), not a Phase 1.6 domain
 * entity like ResearchThread, Claim, or DecisionPackage.
 */

// --- Rules 1-2: Identity + Idempotency ---

/**
 * Rule 1 (Identity): "`eventId` MUST be globally unique. It is the sole
 * basis for deduplication -- nothing downstream may re-derive identity from
 * payload content." Rule 2 (Idempotency): "If an event with a given
 * `eventId` is received more than once, only the first occurrence may
 * produce a state transition. A duplicate delivery is a no-op, not an
 * error and not a second transition."
 *
 * A minimal, generic append-only event log embodying both rules.
 */
export class EventLog<Payload> {
  private readonly seenEventIds = new Set<string>();
  private readonly events: KnowledgeEvent<Payload>[] = [];

  /**
   * Returns true if this call produced a real state transition (the event
   * was new and got appended), false if it was a no-op duplicate. Never
   * throws on a duplicate -- rule 2 is explicit that a duplicate delivery
   * is "not an error."
   */
  append(event: KnowledgeEvent<Payload>): boolean {
    if (this.seenEventIds.has(event.eventId)) {
      return false;
    }
    this.seenEventIds.add(event.eventId);
    this.events.push(event);
    return true;
  }

  has(eventId: string): boolean {
    return this.seenEventIds.has(eventId);
  }

  /** The durable, ordered, deduplicated event log -- the sole source of truth for replay (rule 5). */
  all(): readonly KnowledgeEvent<Payload>[] {
    return this.events;
  }
}

// --- Rules 3-4: Causation + Correlation ---

/**
 * Rule 3 (Causation): "`causationRef` answers 'what event caused this
 * event' -- required whenever an event is a direct consequence of
 * processing another event (e.g. `ADRAccepted` causing
 * `DecisionPackageCreated`)." Whether a given event IS such a consequence
 * is calling-context knowledge the event's own shape cannot determine by
 * itself (the base `KnowledgeEventSchema` leaves `causationRef` nullable
 * for exactly this reason -- a first event like `PromptObserved` has no
 * cause) -- the caller states it explicitly via
 * `isConsequenceOfAnotherEvent`, and this function enforces the rule
 * against that claim.
 */
export function assertCausationRequiredForConsequenceEvent(
  causationRef: string | null,
  isConsequenceOfAnotherEvent: boolean,
): void {
  if (isConsequenceOfAnotherEvent && causationRef === null) {
    throw new Error(
      "Section 26A rule 3 violation: an event that is a direct consequence of processing another event must carry a non-null causationRef",
    );
  }
}

/**
 * Rule 4 (Correlation): "`correlationRef` answers 'what larger operation
 * does this event belong to' -- the thread that groups a whole WorkUnit's
 * events together even when several are not directly causally linked to
 * each other."
 */
export function assertCorrelationRequiredForWorkUnitEvent(
  correlationRef: string | null,
  belongsToWorkUnitFlow: boolean,
): void {
  if (belongsToWorkUnitFlow && correlationRef === null) {
    throw new Error(
      "Section 26A rule 4 violation: an event that belongs to a WorkUnit's larger operation must carry a non-null correlationRef",
    );
  }
}

// --- Rule 5: Replay ---

export interface AggregateActivity {
  eventCount: number;
  latestEventType: string;
  latestOccurredAt: string;
}

/** A deliberately minimal, generic derived projection -- see file header. */
export type AggregateActivityProjection = Readonly<Record<string, AggregateActivity>>;

/**
 * Rule 5 (Replay): "Beacon MUST be able to rebuild all derived/projected
 * state ... purely from the canonical event log." This is the reducer:
 * derived state built only from an ordered event list, nothing else, and
 * nothing outside this function's own arguments. Calling it twice against
 * the same event list always produces the same result -- that determinism
 * is what makes replay meaningful, and is exactly what
 * decision-os-event-replay.test.ts's fixture proves.
 */
export function buildAggregateActivityProjection<Payload>(
  events: readonly KnowledgeEvent<Payload>[],
): AggregateActivityProjection {
  const projection: Record<string, AggregateActivity> = {};
  for (const event of events) {
    const existing = projection[event.aggregateRef];
    projection[event.aggregateRef] = {
      eventCount: (existing?.eventCount ?? 0) + 1,
      latestEventType: event.eventType,
      latestOccurredAt: event.occurredAt,
    };
  }
  return projection;
}
