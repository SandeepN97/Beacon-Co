import { ApprovalManager } from "./approvals/approval-manager";
import { requiredApprovalKinds } from "./approvals/approval-policy";
import { AuditService } from "./audit/audit-service";
import { Broker } from "./broker/broker";
import { CapacityManager } from "./broker/capacity-manager";
import { ProviderRouter } from "./broker/router";
import type { ProviderId, ProviderState } from "./domain/provider";
import type { WorkflowType } from "./domain/work-request.ts";
import type { WorkUnit, WorkUnitRole } from "./domain/work-unit";
import {
  deriveWorkUnitTaskSignals,
  TaskClassificationEventLog,
} from "./decision-os/task-classifier.ts";
import { analyzeDocumentationImpact } from "./documentation/impact-analyzer";
import { createUpdateProposal } from "./documentation/update-proposal";
import type { DocumentIndexEntry } from "./knowledge/document-index";
import { ContextRetriever } from "./knowledge/context-retriever";
import { packageContext } from "./knowledge/context-packager";
import { ClaudeSimulationAdapter, CodexSimulationAdapter } from "./providers/simulated-adapters";
import { IntentTranslator } from "./translator/intent-translator";

export interface SimulationOptions {
  providerState?: Partial<Record<ProviderId, Partial<ProviderState>>>;
}

const taskRoleByWorkflow: Readonly<Record<WorkflowType, WorkUnitRole>> = {
  documentation: "code-writer",
  planning: "chief-of-staff",
  architecture: "chief-of-staff",
  implementation: "codebase-researcher",
  review: "pr-reviewer",
  operations: "release-manager",
  mixed: "chief-of-staff",
};

export function runOrchestrationSimulation(
  rawRequest: string,
  documents: DocumentIndexEntry[],
  options: SimulationOptions = {},
) {
  const retriever = new ContextRetriever(documents);
  const translator = new IntentTranslator(retriever);
  const translation = translator.translate(rawRequest);
  const context = packageContext(translation.request, translation.context);
  const audit = new AuditService();
  audit.record(translation.request.id, "request.translated", "intent-translator", {
    status: translation.request.status,
    workflow: translation.request.workflowType,
  });
  audit.record(translation.request.id, "context.retrieved", "knowledge-retriever", {
    documents: context.approvedDocuments.map(({ id }) => id),
    conflicts: context.conflicts.length,
  });

  const approvals = new ApprovalManager();
  for (const kind of requiredApprovalKinds(translation.request)) {
    approvals.request(translation.request.id, kind, translation.request.normalizedGoal);
    audit.record(translation.request.id, "approval.requested", "approval-manager", {
      kind,
    });
  }

  const workUnit: WorkUnit = {
    id: translation.request.id,
    request: translation.request,
    goal: translation.request.normalizedGoal,
    acceptanceCriteria: [...translation.request.acceptanceCriteria],
    constraints: [...translation.request.constraints],
    risk: translation.request.risk,
    dependencies: [...translation.request.dependencies],
    status:
      translation.request.status === "ready-for-routing"
        ? "ready"
        : translation.request.status === "waiting-for-approval"
          ? "waiting-for-approval"
          : "draft",
    assignedProvider: null,
    authorSessionId: null,
    retryCount: 0,
    ...deriveWorkUnitTaskSignals(
      taskRoleByWorkflow[translation.request.workflowType],
      translation.request.risk,
      Math.ceil(Buffer.byteLength(JSON.stringify(context), "utf8") / 4),
    ),
  };

  // PR-0.6 observation only: the event is recorded before execution and
  // is never passed to Broker, ProviderRouter, or any adapter.
  const taskClassifications = new TaskClassificationEventLog();
  taskClassifications.record(workUnit, {
    eventId: `${workUnit.id}-task-classified`,
    projectRef: "beacon-co",
  });

  const capacity = new CapacityManager(options.providerState);
  const router = new ProviderRouter(capacity);
  const broker = new Broker(router, audit, [
    new ClaudeSimulationAdapter(),
    new CodexSimulationAdapter(),
  ]);
  const execution =
    translation.request.status === "ready-for-routing"
      ? broker.simulate(workUnit, context)
      : { workUnit, routing: null, providerResult: null };
  const documentationImpact = analyzeDocumentationImpact(translation.request, {
    filesChanged: [],
    behaviorChanged: translation.request.workflowType === "implementation",
    architectureChanged: translation.request.workflowType === "architecture",
    businessRuleChanged: false,
    uiChanged: /\b(ui|interface|layout|design)\b/i.test(rawRequest),
  });
  const updateProposal = createUpdateProposal(documentationImpact);
  audit.record(translation.request.id, "documentation.impact", "impact-analyzer", {
    level: documentationImpact.level,
    pages: documentationImpact.pagesToUpdate,
  });

  return {
    translation,
    context,
    capacity: capacity.list(),
    execution,
    taskClassifications: taskClassifications.all(),
    documentationImpact,
    updateProposal,
    approvals: requiredApprovalKinds(translation.request),
    audit: audit.forWorkUnit(translation.request.id),
    simulated: true as const,
  };
}
