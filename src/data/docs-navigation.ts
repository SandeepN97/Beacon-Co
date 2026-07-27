export const docsSectionOrder = [
  "home",
  "getting-started",
  "product",
  "plans",
  "architecture",
  "agents",
  "workflows",
  "governance",
  "security",
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
  security: "Security",
  decisions: "Decision book",
  operations: "Operations",
  references: "References",
};

export function docsHref(id: string): string {
  if (id === "index") return "/docs/";
  return `/docs/${id.replace(/\/index$/, "")}/`;
}
