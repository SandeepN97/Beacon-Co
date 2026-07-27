export type DocumentationImpactLevel = "none" | "reference" | "adr";

export interface DocumentationImpact {
  expected: boolean;
  level: DocumentationImpactLevel;
  reasons: string[];
  pagesToUpdate: string[];
  adrRequired: boolean;
  proposalOnly: boolean;
}
