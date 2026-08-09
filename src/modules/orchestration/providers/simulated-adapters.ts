import type { WorkRequest } from "../domain/work-request";
import type { RetrievedContextPackage } from "../knowledge/context-packager";
import type {
  ProviderPrompt,
  SimulatedProviderAdapter,
  SimulatedProviderResult,
} from "./provider-adapter";
import { compileClaudePrompt } from "./claude/claude-prompt-compiler";
import { compileCodexPrompt } from "./codex/codex-prompt-compiler";

abstract class SimulationAdapter implements SimulatedProviderAdapter {
  abstract readonly provider: "claude" | "codex";

  abstract compile(request: WorkRequest, context: RetrievedContextPackage): ProviderPrompt;

  simulate(request: WorkRequest, context: RetrievedContextPackage): SimulatedProviderResult {
    return {
      provider: this.provider,
      status: "simulated-complete",
      prompt: this.compile(request, context),
      message: `${this.provider === "claude" ? "Claude" : "Codex"} prompt compiled. No live ${
        this.provider === "claude" ? "Claude" : "Codex"
      } session was invoked.`,
      liveInvocation: false,
    };
  }
}

export class ClaudeSimulationAdapter extends SimulationAdapter {
  readonly provider = "claude" as const;

  compile(request: WorkRequest, context: RetrievedContextPackage): ProviderPrompt {
    return {
      provider: this.provider,
      requestId: request.id,
      content: compileClaudePrompt(request, context),
      simulated: true,
    };
  }
}

export class CodexSimulationAdapter extends SimulationAdapter {
  readonly provider = "codex" as const;

  compile(request: WorkRequest, context: RetrievedContextPackage): ProviderPrompt {
    return {
      provider: this.provider,
      requestId: request.id,
      content: compileCodexPrompt(request, context),
      simulated: true,
    };
  }
}
