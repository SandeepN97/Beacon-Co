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
import { buildProviderResult, extractClaudeResult } from "../live-adapter-support.ts";
import { compileClaudePrompt } from "./claude-prompt-compiler.ts";

export class ClaudeAdapter implements ProviderAdapter {
  readonly provider = "claude" as const;
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
      content: compileClaudePrompt(request, context),
      simulated: true,
    };
  }

  simulate(request: WorkRequest, context: RetrievedContextPackage): SimulatedProviderResult {
    return {
      provider: this.provider,
      status: "simulated-complete",
      prompt: this.compile(request, context),
      message: "Claude prompt compiled. No live Claude session was invoked.",
      liveInvocation: false,
    };
  }

  async execute(request: ProviderExecutionRequest): Promise<ProviderExecutionResult> {
    if (!this.transport)
      throw new ProviderExecutionError(
        this.provider,
        "policy",
        "Live Claude transport is not configured.",
        false,
      );
    const startedAt = this.now();
    const response = await this.transport.invoke(this.provider, {
      model: request.resolvedModelId,
      max_tokens: request.maxOutputTokens,
      messages: [{ role: "user", content: request.prompt }],
      metadata: { work_unit_id: request.workUnitId },
    });
    try {
      return buildProviderResult({
        provider: this.provider,
        request,
        response,
        startedAt,
        completedAt: this.now(),
        extraction: extractClaudeResult(response),
      });
    } catch (error) {
      if (error instanceof ProviderExecutionError) throw error;
      throw new ProviderExecutionError(
        this.provider,
        "invalid-response",
        "Claude response could not be normalized.",
        false,
      );
    }
  }
}
