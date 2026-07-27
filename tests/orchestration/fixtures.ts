import type { DocumentIndexEntry } from "../../src/modules/orchestration/knowledge/document-index";

export const documents: DocumentIndexEntry[] = [
  {
    id: "architecture/routing-and-scheduling",
    title: "Routing and scheduling",
    description: "Claude-first policy, Codex code affinity, health, capacity, and fallback.",
    section: "architecture",
    status: "approved",
    sourceFiles: ["BEACON_COMPLETE_EXECUTION_PROMPT.md"],
    relatedAdrs: ["0014-use-provider-adapter-boundary"],
    tags: ["routing", "provider", "fallback", "claude", "codex"],
    body: "Policy eligibility comes first. Claude is preferred for planning and docs. Codex has implementation affinity.",
  },
  {
    id: "governance/human-authority",
    title: "Human authority",
    description: "Approval requirements for consequential actions.",
    section: "governance",
    status: "approved",
    sourceFiles: ["BEACON_COMPLETE_EXECUTION_PROMPT.md"],
    relatedAdrs: ["0012-require-human-approval"],
    tags: ["approval", "production", "privacy"],
    body: "Architecture, spending, legal, production, merge, deployment, and release need human authority.",
  },
  {
    id: "decisions/0006-use-markdoc",
    title: "Use Markdoc",
    description: "Markdoc is canonical project memory.",
    section: "decisions",
    status: "approved",
    sourceFiles: ["BEACON_COMPLETE_EXECUTION_PROMPT.md"],
    relatedAdrs: [],
    tags: ["markdoc", "documentation"],
    body: "Approved documentation is retrieved before substantial work.",
  },
];
