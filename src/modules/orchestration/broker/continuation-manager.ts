import type { ContinuationPackage, WorkUnit } from "../domain/work-unit";

export type ContinuationInput = Omit<
  ContinuationPackage,
  "workUnit" | "originalUserRequest" | "normalizedGoal" | "assumptions"
>;

export class ContinuationManager {
  create(workUnit: WorkUnit, input: ContinuationInput): ContinuationPackage {
    return {
      workUnit,
      originalUserRequest: workUnit.request.rawRequest,
      normalizedGoal: workUnit.request.normalizedGoal,
      assumptions: [...workUnit.request.assumptions],
      ...input,
    };
  }

  validate(packageValue: ContinuationPackage): string[] {
    const required: Array<keyof ContinuationPackage> = [
      "workUnit",
      "originalUserRequest",
      "normalizedGoal",
      "approvedMarkdocContext",
      "acceptedAdrConstraints",
      "filesInspected",
      "filesChanged",
      "currentDiff",
      "commandsRun",
      "testEvidence",
      "decisionsMade",
      "assumptions",
      "openBlockers",
      "requiredNextAction",
      "stopCondition",
    ];
    return required.filter((key) => {
      const value = packageValue[key];
      return value === undefined || value === null || value === "";
    });
  }
}
