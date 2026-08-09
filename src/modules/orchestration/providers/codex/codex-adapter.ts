import type { WorkRequest } from "../../domain/work-request.ts";
import type { RetrievedContextPackage } from "../../knowledge/context-packager.ts";
import type {
  ProviderAdapter,
  ProviderExecutionRequest,
  ProviderExecutionResult,
  ProviderPrompt,
  ProviderTransport,
  SimulatedProviderResult,
} from "../provider-adapter.ts";
import { ProviderExecutionError } from "../provider-adapter.ts";
import { buildProviderResult, extractCodexResult } from "../live-adapter-support.ts";
import { compileCodexPrompt } from "./codex-prompt-compiler.ts";

export class CodexAdapter implements ProviderAdapter {
  readonly provider = "codex" as const;
  private readonly transport: ProviderTransport | null;
  private readonly now: () => Date;

  constructor(transport: ProviderTransport | null = null, now: () => Date = () => new Date()) {
    this.transport = transport;
    this.now = now;
  }

  compile(request: WorkRequest, context: RetrievedContextPackage): ProviderPrompt {
    return {
      provider: this.provider,
      requestId: request.id,
      content: compileCodexPrompt(request, context),
      simulated: true,
    };
  }

  simulate(request: WorkRequest, context: RetrievedContextPackage): SimulatedProviderResult {
    return {
      provider: this.provider,
      status: "simulated-complete",
      prompt: this.compile(request, context),
      message: "Codex prompt compiled. No live Codex session was invoked.",
      liveInvocation: false,
    };
  }

  async execute(request: ProviderExecutionRequest): Promise<ProviderExecutionResult> {
    if (!this.transport)
      throw new ProviderExecutionError(
        this.provider,
        "policy",
        "Live Codex transport is not configured.",
        false,
      );
    const startedAt = this.now();
    const response = await this.transport.invoke(this.provider, {
      model: request.resolvedModelId,
      input: request.prompt,
      max_output_tokens: request.maxOutputTokens,
      reasoning: request.requestedEffort ? { effort: request.requestedEffort } : undefined,
      metadata: { work_unit_id: request.workUnitId },
    });
    try {
      return buildProviderResult({
        provider: this.provider,
        request,
        response,
        startedAt,
        completedAt: this.now(),
        extraction: extractCodexResult(response),
      });
    } catch (error) {
      if (error instanceof ProviderExecutionError) throw error;
      throw new ProviderExecutionError(
        this.provider,
        "invalid-response",
        "Codex response could not be normalized.",
        false,
      );
    }
  }
}
