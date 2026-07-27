import type { WorkRequest } from "../domain/work-request";
import type { SearchResult } from "./document-index";
import { detectConflicts, type DocumentationConflict } from "./conflict-detector";

export interface ContextPackage {
  requestId: string;
  approvedDocuments: Array<{
    id: string;
    title: string;
    status: string;
    excerpt: string;
    sourceFiles: string[];
  }>;
  adrConstraints: string[];
  conflicts: DocumentationConflict[];
}

export function packageContext(request: WorkRequest, results: SearchResult[]): ContextPackage {
  const documents = results.map(({ document }) => document);
  return {
    requestId: request.id,
    approvedDocuments: documents.map((document) => ({
      id: document.id,
      title: document.title,
      status: document.status,
      excerpt: document.body.replace(/\s+/g, " ").trim().slice(0, 800),
      sourceFiles: document.sourceFiles,
    })),
    adrConstraints: documents
      .filter((document) => document.section === "decisions" || /adr/i.test(document.id))
      .map((document) => `${document.id}: ${document.description}`),
    conflicts: detectConflicts(documents),
  };
}
