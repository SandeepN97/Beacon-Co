import type { WorkRequest } from "../../domain/work-request";
import type { ContextPackage } from "../../knowledge/context-packager";
import type { ProviderAdapter, ProviderPrompt, SimulatedProviderResult } from "../provider-adapter";
import { compileClaudePrompt } from "./claude-prompt-compiler";

export class ClaudeAdapter implements ProviderAdapter {
  readonly provider = "claude" as const;

  compile(request: WorkRequest, context: ContextPackage): ProviderPrompt {
    return {
      provider: this.provider,
      requestId: request.id,
      content: compileClaudePrompt(request, context),
      simulated: true,
    };
  }

  simulate(request: WorkRequest, context: ContextPackage): SimulatedProviderResult {
    return {
      provider: this.provider,
      status: "simulated-complete",
      prompt: this.compile(request, context),
      message: "Claude prompt compiled. No live Claude session was invoked.",
      liveInvocation: false,
    };
  }
}
