import type { WorkflowType } from "../domain/work-request";

const workflowCriteria: Record<WorkflowType, string[]> = {
  documentation: [
    "Relevant Markdoc pages contain the approved change and source references.",
    "Documentation schema, links, and static build pass.",
  ],
  planning: [
    "Scope, dependencies, risks, owners, and gates are explicit.",
    "The plan distinguishes current, proposed, and excluded work.",
  ],
  architecture: [
    "Components, boundaries, data flow, risks, alternatives, and phase status are documented.",
    "A human approval requirement is recorded for material architecture change.",
  ],
  implementation: [
    "The requested behavior is implemented within the approved scope.",
    "Applicable tests, type checks, and production build pass.",
  ],
  review: [
    "Findings cite evidence and acceptance criteria.",
    "The reviewer did not author or silently repair the reviewed deliverable.",
  ],
  operations: [
    "The operating change has evidence, rollback guidance, and an authorized approval path.",
    "No production action occurs without explicit approval.",
  ],
  mixed: [
    "Each deliverable has a named owner, evidence, and observable completion condition.",
    "Applicable documentation and deterministic checks pass.",
  ],
};

export function buildAcceptanceCriteria(workflowType: WorkflowType): string[] {
  return [...workflowCriteria[workflowType]];
}
