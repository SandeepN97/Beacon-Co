import type { AgentRiskClass } from "../domain/agent-run.ts";

export interface RiskClassificationInput {
  paths: string[];
  summary: string;
  workflowType: string;
}

const RISK_3 =
  /(?:auth(?:entication|orization)?|credential|secret|production|payment|billing|tool[- ]?(?:policy|gateway)|destructive\s+migration|deploy-production)/i;
const RISK_2 =
  /(?:agent[- ]?contract|\.claude\/agents|\.github\/workflows|package(?:-lock)?\.json|dependency|data[- ]?handling|external[- ]?integration|security[- ]?(?:config|policy))/i;
const RISK_0 = /(?:docs?[- ]?only|copy[- ]?only|non[- ]?behavioral)/i;

export function classifyRisk(input: RiskClassificationInput): AgentRiskClass {
  const material = `${input.summary}\n${input.workflowType}\n${input.paths.join("\n")}`;
  if (RISK_3.test(material)) return "risk-3";
  if (RISK_2.test(material)) return "risk-2";
  if (
    RISK_0.test(material) ||
    (input.workflowType === "documentation" &&
      input.paths.every((path) => /\.(?:md|mdoc)$/.test(path)))
  )
    return "risk-0";
  return "risk-1";
}
