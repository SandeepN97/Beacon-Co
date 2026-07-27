export interface DocumentClaim {
  key: string;
  value: string;
}

export interface DocumentIndexEntry {
  id: string;
  title: string;
  description: string;
  section: string;
  status: "draft" | "under-review" | "approved" | "superseded";
  sourceFiles: string[];
  relatedAdrs: string[];
  tags: string[];
  body: string;
  claims?: DocumentClaim[];
}

export interface SearchResult {
  document: DocumentIndexEntry;
  score: number;
  matchedTerms: string[];
}

const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "with",
]);

export function tokenize(value: string): string[] {
  return [
    ...new Set(
      value
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, " ")
        .split(/\s+/)
        .filter((token) => token.length > 1 && !stopWords.has(token)),
    ),
  ];
}

export class DocumentIndex {
  constructor(readonly entries: DocumentIndexEntry[]) {}

  search(query: string, limit = 8): SearchResult[] {
    const terms = tokenize(query);
    return this.entries
      .map((document) => {
        const title = tokenize(`${document.title} ${document.tags.join(" ")}`);
        const summary = tokenize(
          `${document.description} ${document.section} ${document.id} ${document.body}`,
        );
        const matchedTerms = terms.filter((term) => title.includes(term) || summary.includes(term));
        const score = matchedTerms.reduce(
          (total, term) =>
            total + (title.includes(term) ? 5 : 0) + (summary.includes(term) ? 1 : 0),
          document.status === "approved" ? 2 : document.status === "superseded" ? -5 : 0,
        );
        return { document, score, matchedTerms };
      })
      .filter(({ score }) => score > 0)
      .sort(
        (left, right) =>
          right.score - left.score || left.document.id.localeCompare(right.document.id),
      )
      .slice(0, limit);
  }
}
