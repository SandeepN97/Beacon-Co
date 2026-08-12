import { describe, expect, it } from "vitest";
import { z } from "astro/zod";
import {
  KnowledgeEventSchema,
  KnowledgeEventTypeSchema,
  validateKnowledgeEvent,
} from "../../src/modules/orchestration/decision-os/events.ts";

const payloadSchema = z.object({ note: z.string() });
const base = {
  schemaVersion: 1 as const,
  eventId: "event-1",
  eventType: "ClaimCreated" as const,
  occurredAt: "2026-08-09T12:00:00.000Z",
  actorRef: "actor-1",
  projectRef: "project-1",
  aggregateRef: "aggregate-1",
  projectContextRef: null,
  causationRef: null,
  correlationRef: null,
  payload: { note: "hello" },
};

describe("decision-os event vocabulary", () => {
  it("accepts every documented event type across all lifecycle areas", () => {
    for (const type of [
      "PromptObserved",
      "SourceEvaluated",
      "ClaimCreated",
      "DecisionAccepted",
      "ADRAccepted",
      "AgentRunCompleted",
      "ProviderSwitchTriggered",
      "StoryPublished",
    ]) {
      expect(KnowledgeEventTypeSchema.parse(type)).toBe(type);
    }
  });

  it("rejects an event type outside the closed vocabulary", () => {
    expect(() => KnowledgeEventTypeSchema.parse("SomethingElse")).toThrow();
  });
});

describe("decision-os knowledge event envelope", () => {
  it("parses a complete event with an explicit visibility", () => {
    const event = KnowledgeEventSchema(payloadSchema).parse({ ...base, visibility: "internal" });
    expect(event.visibility).toBe("internal");
    expect(event.payload).toEqual({ note: "hello" });
  });

  it("defaults visibility to private when omitted", () => {
    const event = KnowledgeEventSchema(payloadSchema).parse(base);
    expect(event.visibility).toBe("private");
  });

  it("rejects an unknown field on the envelope", () => {
    expect(() =>
      KnowledgeEventSchema(payloadSchema).parse({ ...base, extraField: "not allowed" }),
    ).toThrow();
  });

  it("rejects a payload that fails the caller-supplied payload schema", () => {
    expect(() =>
      KnowledgeEventSchema(payloadSchema).parse({ ...base, payload: { note: 123 } }),
    ).toThrow();
  });

  it("validates through the validateKnowledgeEvent helper", () => {
    expect(validateKnowledgeEvent(payloadSchema, base).eventType).toBe("ClaimCreated");
  });
});
