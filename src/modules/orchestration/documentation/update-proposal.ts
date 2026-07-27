import type { DocumentationImpact } from "../domain/documentation-impact";

export interface DocumentationUpdateProposal {
  summary: string;
  paths: string[];
  reviewRequired: true;
  automaticWrite: false;
}

export function createUpdateProposal(
  impact: DocumentationImpact,
): DocumentationUpdateProposal {
  return {
    summary: impact.expected
      ? impact.reasons.join(" ")
      : "No canonical documentation change is currently indicated.",
    paths: impact.pagesToUpdate.map((page) => `src/content/docs/${page}.mdoc`),
    reviewRequired: true,
    automaticWrite: false,
  };
}
