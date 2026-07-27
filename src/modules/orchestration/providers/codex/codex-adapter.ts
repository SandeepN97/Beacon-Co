import type { WorkRequest } from "../../domain/work-request";
import type { ContextPackage } from "../../knowledge/context-packager";
import type {
  ProviderAdapter,
  ProviderPrompt,
  SimulatedProviderResult,
} from "../provider-adapter";
import { compileCodexPrompt } from "./codex-prompt-compiler";

export class CodexAdapter implements ProviderAdapter {
  readonly provider = "codex" as const;

  compile(request: WorkRequest, context: ContextPackage): ProviderPrompt {
    return {
      provider: this.provider,
      requestId: request.id,
      content: compileCodexPrompt(request, context),
      simulated: true,
    };
  }

  simulate(
    request: WorkRequest,
    context: ContextPackage,
  ): SimulatedProviderResult {
    return {
      provider: this.provider,
      status: "simulated-complete",
      prompt: this.compile(request, context),
      message: "Codex prompt compiled. No live Codex session was invoked.",
      liveInvocation: false,
    };
  }
}
