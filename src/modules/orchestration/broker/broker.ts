import type {
  SimulatedProviderAdapter,
  SimulatedProviderResult,
} from "../providers/provider-adapter";
import type { RoutingDecision } from "../domain/provider";
import type { WorkUnit } from "../domain/work-unit";
import type { RetrievedContextPackage } from "../knowledge/context-packager";
import type { AuditService } from "../audit/audit-service";
import type { ProviderRouter } from "./router";

export interface BrokerSimulation {
  workUnit: WorkUnit;
  routing: RoutingDecision;
  providerResult: SimulatedProviderResult | null;
}

export class Broker {
  private readonly adapters: Map<string, SimulatedProviderAdapter>;

  constructor(
    private readonly router: ProviderRouter,
    private readonly audit: AuditService,
    adapters: SimulatedProviderAdapter[],
  ) {
    this.adapters = new Map(adapters.map((adapter) => [adapter.provider, adapter]));
  }

  simulate(workUnit: WorkUnit, context: RetrievedContextPackage): BrokerSimulation {
    const routing = this.router.route({
      workflowType: workUnit.request.workflowType,
      dataClassification: workUnit.request.dataClassification,
      preferredProvider: workUnit.request.preferredProvider,
      requiredTools: ["repository-read", "structured-output", "simulation"],
      purpose: "primary",
    });
    this.audit.record(workUnit.id, "provider.routed", "broker", {
      provider: routing.provider,
      reason: routing.reason,
      fallbackUsed: routing.fallbackUsed,
    });

    if (!routing.provider) {
      return {
        workUnit: { ...workUnit, status: "blocked" },
        routing,
        providerResult: null,
      };
    }

    const adapter = this.adapters.get(routing.provider);
    if (!adapter) throw new Error(`No adapter registered for ${routing.provider}`);
    const providerResult = adapter.simulate(workUnit.request, context);
    const routedUnit: WorkUnit = {
      ...workUnit,
      status: "review",
      assignedProvider: routing.provider,
      authorSessionId: `simulated-${routing.provider}-${workUnit.id}`,
    };
    this.audit.record(workUnit.id, "simulation.completed", routing.provider, {
      liveInvocation: false,
      status: providerResult.status,
    });
    return { workUnit: routedUnit, routing, providerResult };
  }
}
