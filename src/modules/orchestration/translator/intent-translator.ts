import type { DocumentIndexEntry, SearchResult } from "../knowledge/document-index";
import type { ContextRetriever } from "../knowledge/context-retriever";
import {
  validateWorkRequest,
  type ProviderPreference,
  type WorkflowType,
  type WorkRequest,
} from "../domain/work-request";
import { buildAcceptanceCriteria } from "./acceptance-criteria-builder";
import { buildAssumptions } from "./assumption-builder";
import { evaluateClarification } from "./clarification-policy";

export interface TranslationResult {
  request: WorkRequest;
  preview: string;
  context: SearchResult[];
}

const workflowRules: Array<[RegExp, WorkflowType]> = [
  [/\b(document|docs|markdoc|adr|runbook|guide|copy)\b/i, "documentation"],
  [/\b(architect|system design|boundary|data flow|integration)\b/i, "architecture"],
  [/\b(implement|build|code|fix|bug|component|test)\b/i, "implementation"],
  [/\b(review|critique|audit|inspect|check)\b/i, "review"],
  [/\b(deploy|release|incident|operate|monitor|backup)\b/i, "operations"],
  [/\b(plan|roadmap|strategy|milestone|business)\b/i, "planning"],
];

const roleByWorkflow: Record<WorkflowType, string> = {
  documentation: "technical-writer",
  planning: "program-manager",
  architecture: "solution-architect",
  implementation: "codebase-researcher",
  review: "pr-reviewer",
  operations: "devops-engineer",
  mixed: "chief-of-staff",
};

function inferWorkflow(rawRequest: string): WorkflowType {
  const matches = workflowRules.filter(([pattern]) => pattern.test(rawRequest));
  if (matches.length === 0) return "mixed";
  const distinct = [...new Set(matches.map(([, workflow]) => workflow))];
  return distinct.length > 1 ? "mixed" : distinct[0];
}

function preferredProvider(
  rawRequest: string,
  workflow: WorkflowType,
): {
  preference: ProviderPreference;
  reason: string;
} {
  const asksForClaude = /\b(use|with|via|prefer|choose)\s+claude\b/i.test(rawRequest);
  const asksForCodex = /\b(use|with|via|prefer|choose)\s+codex\b/i.test(rawRequest);
  if (asksForClaude !== asksForCodex) {
    return asksForClaude
      ? {
          preference: "claude",
          reason: "The user explicitly requested Claude; policy eligibility still has priority.",
        }
      : {
          preference: "codex",
          reason: "The user explicitly requested Codex; policy eligibility still has priority.",
        };
  }
  if (workflow === "implementation" || workflow === "review") {
    return {
      preference: "codex",
      reason:
        "Initial policy gives Codex affinity for repository implementation, tests, and code review.",
    };
  }
  return {
    preference: "claude",
    reason:
      "Claude-first is the configured preference for planning, architecture, and documentation.",
  };
}

function stableId(rawRequest: string): string {
  let value = 2166136261;
  for (const character of rawRequest) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  const label =
    rawRequest
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 36) || "request";
  return `${label}-${(value >>> 0).toString(16).padStart(8, "0")}`;
}

function conciseGoal(rawRequest: string): string {
  const clean = rawRequest.replace(/\s+/g, " ").trim();
  return clean.length <= 180 ? clean : `${clean.slice(0, 177)}...`;
}

function collectSources(context: SearchResult[]) {
  const relevantDocs = context.map(({ document }) => document.id);
  const relevantAdrs = context
    .filter(({ document }) => document.section === "decisions" || /adr/i.test(document.id))
    .map(({ document }) => document.id);
  return { relevantDocs, relevantAdrs };
}

export class IntentTranslator {
  constructor(private readonly retriever: ContextRetriever) {}

  translate(rawRequest: string): TranslationResult {
    const raw = rawRequest.trim();
    if (!raw) throw new Error("A natural-language request is required.");

    const workflowType = inferWorkflow(raw);
    const context = this.retriever.retrieve(raw, { limit: 8 });
    const clarification = evaluateClarification(raw, workflowType);
    const provider = preferredProvider(raw, workflowType);
    const sources = collectSources(context);
    const assumptions = buildAssumptions(raw, workflowType);
    const deliverable =
      workflowType === "mixed"
        ? "A scoped work package with an approved execution path"
        : `A reviewable ${workflowType} deliverable`;

    const request = validateWorkRequest({
      id: stableId(raw),
      rawRequest: rawRequest,
      normalizedGoal: conciseGoal(raw),
      businessOutcome:
        "Advance the stated Beacon outcome while preserving approved project boundaries.",
      workflowType,
      requestedDeliverables: [deliverable],
      acceptanceCriteria: buildAcceptanceCriteria(workflowType),
      constraints: [
        "Follow AGENTS.md and approved Markdoc guidance.",
        "Preserve unrelated repository work.",
        "Use evidence and deterministic checks before completion.",
      ],
      nonGoals: [
        "No silent scope expansion.",
        "No production action or external side effect without explicit authority.",
      ],
      assumptions,
      openQuestions: clarification.questions,
      dependencies: sources.relevantDocs,
      risk: clarification.risk,
      dataClassification: "internal",
      requiredApprovals: clarification.approvals,
      relevantDocs: sources.relevantDocs,
      relevantAdrs: sources.relevantAdrs,
      recommendedFirstRole: roleByWorkflow[workflowType],
      preferredProvider: provider.preference,
      providerReason: provider.reason,
      documentationImpactExpected:
        workflowType !== "review" || /\b(document|adr|architecture|business|ui)\b/i.test(raw),
      status:
        clarification.questions.length > 0
          ? "waiting-for-user"
          : clarification.approvals.length > 0
            ? "waiting-for-approval"
            : "ready-for-routing",
    });

    return {
      request,
      context,
      preview: formatInterpretation(
        request,
        context.map(({ document }) => document),
      ),
    };
  }
}

export function formatInterpretation(request: WorkRequest, context: DocumentIndexEntry[]): string {
  const list = (items: string[]) => (items.length ? items.join("; ") : "None");
  return [
    "I understood your request as:",
    "",
    `Goal: ${request.normalizedGoal}`,
    `Deliverables: ${list(request.requestedDeliverables)}`,
    `What is not included: ${list(request.nonGoals)}`,
    `Assumptions: ${list(request.assumptions)}`,
    `Questions that must be answered: ${list(request.openQuestions)}`,
    `Relevant company rules: ${list(context.map((document) => document.title))}`,
    `Recommended workflow: ${request.workflowType}`,
    `Likely first agent: ${request.recommendedFirstRole}`,
    `Suggested provider: ${request.preferredProvider} — ${request.providerReason}`,
    `Human approvals: ${list(request.requiredApprovals)}`,
    `Definition of done: ${list(request.acceptanceCriteria)}`,
  ].join("\n");
}
