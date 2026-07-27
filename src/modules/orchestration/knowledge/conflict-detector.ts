import type { DocumentIndexEntry } from "./document-index";

export interface DocumentationConflict {
  key: string;
  sources: string[];
  values: string[];
  reason: string;
}

export function detectConflicts(documents: DocumentIndexEntry[]): DocumentationConflict[] {
  const claims = new Map<string, Array<{ value: string; source: string }>>();
  for (const document of documents.filter(({ status }) => status !== "superseded")) {
    for (const claim of document.claims ?? []) {
      const existing = claims.get(claim.key) ?? [];
      existing.push({ value: claim.value, source: document.id });
      claims.set(claim.key, existing);
    }
  }

  return [...claims.entries()]
    .map(([key, entries]) => ({
      key,
      sources: [...new Set(entries.map(({ source }) => source))],
      values: [...new Set(entries.map(({ value }) => value))],
      reason: `Approved/current sources disagree about “${key}”.`,
    }))
    .filter(({ values }) => values.length > 1);
}
