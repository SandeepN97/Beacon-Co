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
      "currentDiffRef",
      "commandsRun",
      "testEvidence",
      "decisionsMade",
      "assumptions",
      "openBlockers",
      "requiredNextAction",
      "stopCondition",
      "publicationState",
    ];
    return required.filter((key) => {
      const value = packageValue[key];
      return value === undefined || value === null || value === "";
    });
  }

  forCandidate(packageValue: ContinuationPackage, candidateSha: string): ContinuationPackage {
    const state = packageValue.publicationState;
    if (state.candidateSha === candidateSha) return packageValue;

    const invalidated = new Set(
      state.requiredGates.filter((gate) => gate.candidateShaBound).map((gate) => gate.name),
    );
    const completedGates = state.completedGates.filter((gate) => !invalidated.has(gate));
    const failedGates = state.failedGates.filter((gate) => !invalidated.has(gate));
    const outstandingGates = [
      ...new Set([
        ...state.outstandingGates,
        ...state.requiredGates.filter((gate) => gate.candidateShaBound).map((gate) => gate.name),
      ]),
    ].sort();
    const isTierReady = (tier: "local" | "publication" | "external") =>
      state.requiredGates
        .filter((gate) => gate.tier === tier)
        .every((gate) => completedGates.includes(gate.name));

    return {
      ...packageValue,
      publicationState: {
        ...state,
        candidateSha,
        localReady: isTierReady("local"),
        publicationReady: isTierReady("publication"),
        externalReady: isTierReady("external"),
        completedGates,
        failedGates,
        outstandingGates,
        evidenceRefs: state.evidenceRefs.filter(
          (reference) => reference.candidateSha === null || reference.candidateSha === candidateSha,
        ),
        nextAuthorizedAction: "Run the invalidated candidate-bound gates before publication.",
      },
    };
  }
}
