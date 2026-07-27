import documentCatalog from "../../data/document-catalog.json";
import type { DocumentIndexEntry } from "./knowledge/document-index";
import { runOrchestrationSimulation } from "./simulation";

export function simulateWorkspaceRequest(rawRequest: string) {
  return runOrchestrationSimulation(
    rawRequest,
    documentCatalog as DocumentIndexEntry[],
  );
}
