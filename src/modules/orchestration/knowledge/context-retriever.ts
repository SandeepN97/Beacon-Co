import { DocumentIndex, type DocumentIndexEntry, type SearchResult } from "./document-index";

export interface RetrievalOptions {
  limit?: number;
  includeSuperseded?: boolean;
}

export class ContextRetriever {
  private readonly index: DocumentIndex;

  constructor(entries: DocumentIndexEntry[]) {
    this.index = new DocumentIndex(entries);
  }

  retrieve(query: string, options: RetrievalOptions = {}): SearchResult[] {
    const results = this.index.search(query, (options.limit ?? 8) * 2);
    return results
      .filter(({ document }) => options.includeSuperseded || document.status !== "superseded")
      .slice(0, options.limit ?? 8);
  }
}
