import type { WorkflowType } from "../domain/work-request";

export interface WorkflowDefinition {
  type: WorkflowType;
  stages: string[];
  boundedRetries: number;
}

const definitions: Record<WorkflowType, WorkflowDefinition> = {
  documentation: {
    type: "documentation",
    stages: ["intake", "context", "draft", "validate", "review", "documentation-impact"],
    boundedRetries: 2,
  },
  planning: {
    type: "planning",
    stages: ["intake", "context", "plan", "second-voice", "human-gate"],
    boundedRetries: 1,
  },
  architecture: {
    type: "architecture",
    stages: ["intake", "context", "design", "security", "second-voice", "human-gate"],
    boundedRetries: 2,
  },
  implementation: {
    type: "implementation",
    stages: ["intake", "context", "research", "implement", "test", "diff-review", "completion"],
    boundedRetries: 3,
  },
  review: {
    type: "review",
    stages: ["intake", "evidence", "independent-review", "verdict"],
    boundedRetries: 1,
  },
  operations: {
    type: "operations",
    stages: ["intake", "context", "prepare", "validate", "human-gate", "handoff"],
    boundedRetries: 2,
  },
  mixed: {
    type: "mixed",
    stages: ["intake", "clarify", "plan", "route"],
    boundedRetries: 1,
  },
};

export class WorkflowRegistry {
  get(type: WorkflowType): WorkflowDefinition {
    return definitions[type];
  }

  list(): WorkflowDefinition[] {
    return Object.values(definitions);
  }
}
