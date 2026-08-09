export interface Phase15GateState {
  local: Record<string, boolean>;
  external: Record<string, boolean>;
}

export interface Phase15AuditResult {
  phase: "1.5";
  status: "complete-frozen" | "in-progress";
  localReady: boolean;
  externalReady: boolean;
  failedLocalGates: string[];
  failedExternalGates: string[];
  closureSentence: string | null;
}

export function evaluatePhase15Completion(state: Phase15GateState): Phase15AuditResult {
  const failedLocalGates = Object.entries(state.local)
    .filter(([, passed]) => !passed)
    .map(([name]) => name)
    .sort();
  const failedExternalGates = Object.entries(state.external)
    .filter(([, passed]) => !passed)
    .map(([name]) => name)
    .sort();
  const localReady = failedLocalGates.length === 0;
  const externalReady = failedExternalGates.length === 0;
  const complete = localReady && externalReady;
  return {
    phase: "1.5",
    status: complete ? "complete-frozen" : "in-progress",
    localReady,
    externalReady,
    failedLocalGates,
    failedExternalGates,
    closureSentence: complete
      ? "Phase 1.5 closed. Beacon may proceed to the next business-domain/UI phase."
      : null,
  };
}
