import type { AuditEvent, AuditEventType } from "./event-types";

export class AuditService {
  private readonly events: AuditEvent[] = [];

  record(
    workUnitId: string,
    type: AuditEventType,
    actor: string,
    detail: Record<string, unknown>,
  ): AuditEvent {
    const event = {
      id: `${workUnitId}-${this.events.length + 1}`,
      workUnitId,
      type,
      occurredAt: new Date().toISOString(),
      actor,
      detail,
    };
    this.events.push(event);
    return event;
  }

  forWorkUnit(workUnitId: string): AuditEvent[] {
    return this.events.filter((event) => event.workUnitId === workUnitId);
  }
}
