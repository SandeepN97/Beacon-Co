export const docsSectionOrder = [
  "home",
  "getting-started",
  "product",
  "plans",
  "architecture",
  "agents",
  "workflows",
  "governance",
  "decisions",
  "operations",
  "references",
] as const;

export const docsSectionLabels: Record<string, string> = {
  home: "Start here",
  "getting-started": "Getting started",
  product: "Product",
  plans: "Plans",
  architecture: "Architecture",
  agents: "Agent organization",
  workflows: "Workflows",
  governance: "Governance",
  decisions: "Decision book",
  operations: "Operations",
  references: "References",
};

export function docsHref(id: string): string {
  return id === "index" ? "/docs/" : `/docs/${id}/`;
}
