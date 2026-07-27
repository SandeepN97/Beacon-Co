import type { ProviderId, RoutingDecision, RoutingRequest } from "../domain/provider";
import type { CapacityManager } from "./capacity-manager";
import { defaultRoutingPolicy, scoreProvider, type RoutingPolicyConfig } from "./routing-policy";

export class ProviderRouter {
  constructor(
    private readonly capacity: CapacityManager,
    private readonly config: RoutingPolicyConfig = defaultRoutingPolicy,
  ) {}

  route(request: RoutingRequest): RoutingDecision {
    const scores = this.capacity
      .list()
      .map((state) => scoreProvider(state, request, this.config))
      .sort((left, right) => right.score - left.score);
    const selected = scores.find(({ eligible }) => eligible);
    if (!selected) {
      return {
        provider: null,
        reason:
          "No provider satisfies policy, capability, health, cooldown, and capacity requirements.",
        scores,
        fallbackUsed: false,
      };
    }

    const requested = request.preferredProvider === "auto" ? null : request.preferredProvider;
    return {
      provider: selected.provider,
      reason: selected.reasons.join("; "),
      scores,
      fallbackUsed: requested !== null && requested !== selected.provider,
    };
  }

  independentReviewer(
    authorProvider: ProviderId,
    authorSessionId: string,
    request: Omit<RoutingRequest, "purpose" | "authorProvider" | "authorSessionId">,
  ): RoutingDecision {
    return this.route({
      ...request,
      purpose: "review",
      authorProvider,
      authorSessionId,
    });
  }
}
