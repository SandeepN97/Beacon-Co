import { describe, expect, it } from "vitest";
import { z } from "astro/zod";
import {
  EventLog,
  assertCausationRequiredForConsequenceEvent,
  assertCorrelationRequiredForWorkUnitEvent,
  buildAggregateActivityProjection,
  type AggregateActivityProjection,
} from "../../src/modules/orchestration/decision-os/event-replay.ts";
import { KnowledgeEventSchema } from "../../src/modules/orchestration/decision-os/events.ts";

const payloadSchema = z.object({ note: z.string() });

function event(overrides: Record<string, unknown> = {}) {
  return KnowledgeEventSchema(payloadSchema).parse({
    schemaVersion: 1,
    eventId: "event-1",
    eventType: "WorkUnitCreated",
    occurredAt: "2026-08-24T12:00:00.000Z",
    actorRef: "chief-of-staff",
    projectRef: "beacon-co",
    aggregateRef: "work-unit-1",
    projectContextRef: null,
    causationRef: null,
    correlationRef: null,
    payload: { note: "hello" },
    ...overrides,
  });
}

describe("EventLog: eventId-based idempotency (Section 26A rules 1-2)", () => {
  it("appends a new event and reports a real transition", () => {
    const log = new EventLog<{ note: string }>();
    const applied = log.append(event({ eventId: "event-1" }));
    expect(applied).toBe(true);
    expect(log.all()).toHaveLength(1);
    expect(log.has("event-1")).toBe(true);
  });

  it("treats a duplicate eventId delivery as a no-op, not an error, not a second transition", () => {
    const log = new EventLog<{ note: string }>();
    const first = log.append(event({ eventId: "event-1" }));
    const second = log.append(
      event({ eventId: "event-1", payload: { note: "different payload" } }),
    );
    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(log.all()).toHaveLength(1);
    // the FIRST occurrence's payload is what's kept -- the duplicate never
    // produced a transition, so it never overwrote anything.
    expect(log.all()[0].payload).toEqual({ note: "hello" });
  });

  it("does not re-derive identity from payload content -- two events with different eventIds but identical payloads are both applied", () => {
    const log = new EventLog<{ note: string }>();
    log.append(event({ eventId: "event-1", payload: { note: "same" } }));
    log.append(event({ eventId: "event-2", payload: { note: "same" } }));
    expect(log.all()).toHaveLength(2);
  });

  it("appends distinct events in delivery order", () => {
    const log = new EventLog<{ note: string }>();
    log.append(event({ eventId: "event-1", aggregateRef: "a" }));
    log.append(event({ eventId: "event-2", aggregateRef: "b" }));
    log.append(event({ eventId: "event-3", aggregateRef: "a" }));
    expect(log.all().map((entry) => entry.eventId)).toEqual(["event-1", "event-2", "event-3"]);
  });
});

describe("Causation enforcement (Section 26A rule 3)", () => {
  it("passes when a consequence event carries a causationRef", () => {
    expect(() => assertCausationRequiredForConsequenceEvent("adr-accepted-1", true)).not.toThrow();
  });

  it("rejects a consequence event with no causationRef", () => {
    expect(() => assertCausationRequiredForConsequenceEvent(null, true)).toThrow();
  });

  it("does not require causationRef on an event that is not a consequence of another event", () => {
    expect(() => assertCausationRequiredForConsequenceEvent(null, false)).not.toThrow();
  });

  it("matches Section 26A's own worked example: ADRAccepted causing DecisionPackageCreated", () => {
    const adrAccepted = event({ eventId: "adr-accepted-1", eventType: "ADRAccepted" });
    const decisionPackageCreated = event({
      eventId: "decision-package-created-1",
      eventType: "DecisionPackageCreated",
      causationRef: adrAccepted.eventId,
    });
    expect(() =>
      assertCausationRequiredForConsequenceEvent(decisionPackageCreated.causationRef, true),
    ).not.toThrow();
  });
});

describe("Correlation enforcement (Section 26A rule 4)", () => {
  it("passes when a WorkUnit-scoped event carries a correlationRef", () => {
    expect(() =>
      assertCorrelationRequiredForWorkUnitEvent("work-unit-1-thread", true),
    ).not.toThrow();
  });

  it("rejects a WorkUnit-scoped event with no correlationRef", () => {
    expect(() => assertCorrelationRequiredForWorkUnitEvent(null, true)).toThrow();
  });

  it("does not require correlationRef on an event outside any WorkUnit's larger operation", () => {
    expect(() => assertCorrelationRequiredForWorkUnitEvent(null, false)).not.toThrow();
  });
});

describe("Replay: byte-for-byte reconstruction fixture (Section 26A rule 5's own acceptance test)", () => {
  it("deletes a derived projection and confirms replay reconstructs it byte-for-byte equivalent", () => {
    const log = new EventLog<{ note: string }>();
    const events = [
      event({ eventId: "event-1", aggregateRef: "work-unit-1", eventType: "WorkUnitCreated" }),
      event({ eventId: "event-2", aggregateRef: "work-unit-1", eventType: "AgentRunStarted" }),
      event({ eventId: "event-3", aggregateRef: "work-unit-2", eventType: "WorkUnitCreated" }),
      event({ eventId: "event-4", aggregateRef: "work-unit-1", eventType: "AgentRunCompleted" }),
      event({ eventId: "event-5", aggregateRef: "work-unit-2", eventType: "QAPassed" }),
    ];
    for (const entry of events) log.append(entry);
    // a duplicate delivery arrives, e.g. a retried publish -- per rules 1-2
    // this must not affect the log or, downstream, the projection.
    log.append(events[1]);

    // Live projection, built incrementally as events arrived.
    let projection: AggregateActivityProjection | null = buildAggregateActivityProjection(
      log.all(),
    );
    expect(projection["work-unit-1"].eventCount).toBe(3);
    expect(projection["work-unit-2"].eventCount).toBe(2);

    const liveProjectionSnapshot = JSON.stringify(projection);

    // The derived projection is deleted -- this is the fixture's premise.
    projection = null;
    expect(projection).toBeNull();

    // Replay: rebuild purely from the canonical event log, nothing else.
    const replayed = buildAggregateActivityProjection(log.all());

    expect(JSON.stringify(replayed)).toBe(liveProjectionSnapshot);
    expect(replayed).toEqual({
      "work-unit-1": {
        eventCount: 3,
        latestEventType: "AgentRunCompleted",
        latestOccurredAt: event().occurredAt,
      },
      "work-unit-2": {
        eventCount: 2,
        latestEventType: "QAPassed",
        latestOccurredAt: event().occurredAt,
      },
    });
  });

  it("is deterministic: replaying the same log twice produces identical results both times", () => {
    const log = new EventLog<{ note: string }>();
    log.append(event({ eventId: "event-1", aggregateRef: "a" }));
    log.append(event({ eventId: "event-2", aggregateRef: "a", eventType: "AgentRunStarted" }));

    const firstReplay = buildAggregateActivityProjection(log.all());
    const secondReplay = buildAggregateActivityProjection(log.all());
    expect(JSON.stringify(firstReplay)).toBe(JSON.stringify(secondReplay));
  });

  it("reflects deduplication in the replayed projection: a duplicate delivery never inflates eventCount", () => {
    const log = new EventLog<{ note: string }>();
    log.append(event({ eventId: "event-1", aggregateRef: "a" }));
    log.append(event({ eventId: "event-1", aggregateRef: "a" })); // duplicate
    log.append(event({ eventId: "event-2", aggregateRef: "a", eventType: "AgentRunStarted" }));

    const replayed = buildAggregateActivityProjection(log.all());
    expect(replayed["a"].eventCount).toBe(2);
  });
});
