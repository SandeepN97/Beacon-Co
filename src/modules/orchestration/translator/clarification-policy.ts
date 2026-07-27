import type { Risk, WorkflowType } from "../domain/work-request";

export interface ClarificationResult {
  questions: string[];
  risk: Risk;
  approvals: string[];
}

const materialPatterns = [
  {
    pattern: /\b(delete|erase|wipe|reset|destroy|drop)\b/i,
    question: "What exact target may be changed, and what recovery path is approved?",
    risk: "critical" as const,
    approval: "production-change",
  },
  {
    pattern: /\b(deploy|production|publish|release|merge|push)\b/i,
    question: "Which environment and authorized human approval govern this action?",
    risk: "high" as const,
    approval: "release",
  },
  {
    pattern: /\b(payment|spend|budget|purchase|billing|price)\b/i,
    question: "What approved budget or pricing authority applies?",
    risk: "high" as const,
    approval: "spending",
  },
  {
    pattern: /\b(legal|privacy|personal data|pii|credential|secret)\b/i,
    question: "What data classification and qualified approval apply?",
    risk: "high" as const,
    approval: "legal-privacy",
  },
];

export function evaluateClarification(
  rawRequest: string,
  workflowType: WorkflowType,
): ClarificationResult {
  const matches = materialPatterns.filter(({ pattern }) => pattern.test(rawRequest));
  const architectureIsMaterial =
    workflowType === "architecture" && /\b(change|replace|migrate|new|switch)\b/i.test(rawRequest);

  const questions = matches.map(({ question }) => question);
  const approvals = matches.map(({ approval }) => approval);
  if (architectureIsMaterial) {
    questions.push(
      "Which current boundary may change, and who approves the architecture decision?",
    );
    approvals.push("architecture");
  }

  const risk = matches.some((match) => match.risk === "critical")
    ? "critical"
    : matches.length > 0 || architectureIsMaterial
      ? "high"
      : workflowType === "implementation" || workflowType === "operations"
        ? "medium"
        : "low";

  return {
    questions: [...new Set(questions)],
    risk,
    approvals: [...new Set(approvals)],
  };
}
