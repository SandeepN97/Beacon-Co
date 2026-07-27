import type { DocumentationImpact } from "../domain/documentation-impact";
import type { WorkRequest } from "../domain/work-request";

export interface CompletedWorkSummary {
  filesChanged: string[];
  behaviorChanged: boolean;
  architectureChanged: boolean;
  businessRuleChanged: boolean;
  uiChanged: boolean;
}

export function analyzeDocumentationImpact(
  request: WorkRequest,
  summary: CompletedWorkSummary,
): DocumentationImpact {
  const reasons: string[] = [];
  const pages = new Set<string>();
  if (summary.architectureChanged || request.workflowType === "architecture") {
    reasons.push("Architecture boundary or decision changed.");
    pages.add("architecture/overview");
    pages.add("decisions/index");
  }
  if (summary.businessRuleChanged) {
    reasons.push("Business rule or operating definition changed.");
    pages.add("product/vision");
    pages.add("decisions/index");
  }
  if (summary.uiChanged) {
    reasons.push("User interface or interaction changed.");
    pages.add("product/principles");
  }
  if (summary.behaviorChanged || request.workflowType === "implementation") {
    reasons.push("Implemented behavior changed.");
    pages.add("plans/current-phase");
  }
  if (summary.filesChanged.some((file) => file.endsWith(".mdoc"))) {
    reasons.push("Canonical Markdoc content changed.");
    pages.add("references/source-map");
  }
  if (request.documentationImpactExpected && reasons.length === 0) {
    reasons.push("The translated request expects documentation impact review.");
    pages.add("references/open-questions");
  }
  const adrRequired =
    summary.architectureChanged || summary.businessRuleChanged;
  return {
    expected: reasons.length > 0,
    level: adrRequired ? "adr" : reasons.length > 0 ? "reference" : "none",
    reasons,
    pagesToUpdate: [...pages],
    adrRequired,
    proposalOnly: true,
  };
}
