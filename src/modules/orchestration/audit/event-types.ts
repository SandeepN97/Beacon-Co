export type AuditEventType =
  | "request.translated"
  | "context.retrieved"
  | "provider.routed"
  | "provider.fallback"
  | "approval.requested"
  | "approval.decided"
  | "gate.recorded"
  | "simulation.completed"
  | "documentation.impact";

export interface AuditEvent {
  id: string;
  workUnitId: string;
  type: AuditEventType;
  occurredAt: string;
  actor: string;
  detail: Record<string, unknown>;
}
