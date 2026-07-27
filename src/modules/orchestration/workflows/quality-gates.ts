import type { QualityGateResult } from "../domain/evidence";

export function deterministicGatesPass(gates: QualityGateResult[]): boolean {
  return gates.every((gate) => !gate.blocking || gate.passed);
}

export function summarizeGates(gates: QualityGateResult[]): string[] {
  return gates.map(
    (gate) => `${gate.passed ? "PASS" : "FAIL"} ${gate.name}: ${gate.evidence}`,
  );
}
