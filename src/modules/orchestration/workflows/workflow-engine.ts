import type { WorkUnit, WorkUnitStatus } from "../domain/work-unit";
import type { WorkflowDefinition } from "./workflow-registry";

export interface WorkflowState {
  workUnitId: string;
  stage: string;
  stageIndex: number;
  status: WorkUnitStatus;
  history: string[];
}

export class WorkflowEngine {
  start(workUnit: WorkUnit, definition: WorkflowDefinition): WorkflowState {
    return {
      workUnitId: workUnit.id,
      stage: definition.stages[0],
      stageIndex: 0,
      status: "ready",
      history: [definition.stages[0]],
    };
  }

  advance(state: WorkflowState, definition: WorkflowDefinition): WorkflowState {
    const nextIndex = state.stageIndex + 1;
    if (nextIndex >= definition.stages.length) {
      return { ...state, status: "review" };
    }
    return {
      ...state,
      stageIndex: nextIndex,
      stage: definition.stages[nextIndex],
      status: "simulating",
      history: [...state.history, definition.stages[nextIndex]],
    };
  }
}
