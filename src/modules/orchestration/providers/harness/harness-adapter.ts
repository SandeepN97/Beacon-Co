import { execFile } from "node:child_process";
import type { WorkRequest } from "../../domain/work-request.ts";
import type { RetrievedContextPackage } from "../../knowledge/context-packager.ts";
import { compileCodexPrompt } from "../codex/codex-prompt-compiler.ts";
import {
  ProviderExecutionError,
  type ProviderAdapter,
  type ProviderExecutionRequest,
  type ProviderExecutionResult,
  type ProviderPrompt,
  type SimulatedProviderResult,
} from "../provider-adapter.ts";
import { normalizeOpenCodeResult } from "./opencode-normalizer.ts";

export const GROQ_CREDENTIAL_ENV_VAR = "GROQ_API_KEY";
const REQUIRED_EXECUTABLE_PATH_ENV_VAR = "PATH";

export interface HarnessProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface HarnessTransport {
  invoke(payload: { resolvedModelId: string; prompt: string }): Promise<HarnessProcessResult>;
}

export type HarnessProcessRunner = (
  file: string,
  args: string[],
  options: {
    cwd: string;
    encoding: "utf8";
    maxBuffer: number;
    timeout: number;
    env: NodeJS.ProcessEnv;
  },
) => Promise<HarnessProcessResult>;

const defaultProcessRunner: HarnessProcessRunner = (file, args, options) =>
  new Promise((resolve) => {
    const child = execFile(file, args, options, (error, stdout, stderr) => {
      const exitCode =
        error && typeof error.code === "number" ? error.code : error === null ? 0 : 1;
      resolve({ stdout, stderr, exitCode });
    });
    child.stdin?.end();
  });

export interface OpenCodeProcessTransportOptions {
  repositoryRoot: string;
  environment?: NodeJS.ProcessEnv;
  processRunner?: HarnessProcessRunner;
  timeoutMs?: number;
}

/** Section 29B.10.2 steps 2-4: spawn OpenCode and capture its process output. */
export class OpenCodeProcessTransport implements HarnessTransport {
  private readonly sourceEnvironment: NodeJS.ProcessEnv;
  private readonly processRunner: HarnessProcessRunner;
  private readonly timeoutMs: number;

  constructor(private readonly options: OpenCodeProcessTransportOptions) {
    this.sourceEnvironment = options.environment ?? process.env;
    this.processRunner = options.processRunner ?? defaultProcessRunner;
    this.timeoutMs = options.timeoutMs ?? 120_000;
  }

  async invoke(payload: {
    resolvedModelId: string;
    prompt: string;
  }): Promise<HarnessProcessResult> {
    if (!payload.resolvedModelId.startsWith("groq/")) {
      throw new ProviderExecutionError(
        "groq",
        "policy",
        "OpenCodeProcessTransport accepts only an explicit groq/<model> identity.",
        false,
      );
    }
    const credential = this.sourceEnvironment[GROQ_CREDENTIAL_ENV_VAR];
    if (!credential) {
      throw new ProviderExecutionError(
        "groq",
        "authentication",
        `${GROQ_CREDENTIAL_ENV_VAR} is not configured for the OpenCode harness.`,
        false,
      );
    }
    const executablePath = this.sourceEnvironment[REQUIRED_EXECUTABLE_PATH_ENV_VAR];
    if (!executablePath) {
      throw new ProviderExecutionError(
        "groq",
        "policy",
        `${REQUIRED_EXECUTABLE_PATH_ENV_VAR} is not configured for the OpenCode harness.`,
        false,
      );
    }

    let result: HarnessProcessResult;
    try {
      // `opencode run [message..]` currently requires the prompt as a positional
      // argument. The caller must therefore provide only bounded, secret-free
      // context: process arguments may be observable outside this process.
      result = await this.processRunner(
        "opencode",
        ["run", "--format", "json", "--model", payload.resolvedModelId, payload.prompt],
        {
          cwd: this.options.repositoryRoot,
          encoding: "utf8",
          maxBuffer: 20 * 1024 * 1024,
          timeout: this.timeoutMs,
          // Do not inherit the parent environment. PATH is required to resolve
          // the CLI; GROQ_API_KEY is the only authorized child credential.
          env: {
            [REQUIRED_EXECUTABLE_PATH_ENV_VAR]: executablePath,
            [GROQ_CREDENTIAL_ENV_VAR]: credential,
          },
        },
      );
    } catch {
      throw new ProviderExecutionError("groq", "transient", "OpenCode could not be spawned.", true);
    }

    if (result.exitCode !== 0) {
      if (/rate.?limit|quota|usage.?limit|capacity/i.test(result.stderr)) {
        throw new ProviderExecutionError(
          "groq",
          "capacity",
          "The OpenCode Groq backend was unavailable.",
          true,
        );
      }
      if (/auth|login|credential|unauthorized|api.?key/i.test(result.stderr)) {
        throw new ProviderExecutionError(
          "groq",
          "authentication",
          "OpenCode could not authenticate to the Groq backend.",
          false,
        );
      }
      throw new ProviderExecutionError(
        "groq",
        "transient",
        "OpenCode exited without a successful result.",
        true,
      );
    }
    return result;
  }
}

export interface HarnessAdapterOptions {
  repositoryRoot: string;
  transport?: HarnessTransport;
  now?: () => Date;
}

/**
 * OpenCode/Groq scaffold behind the same ProviderAdapter contract as the
 * Claude and Codex adapters. It is intentionally absent from CapacityManager,
 * Broker construction, role eligibility, and every live routing table.
 */
export class HarnessAdapter implements ProviderAdapter {
  readonly provider = "groq" as const;
  private readonly transport: HarnessTransport;
  private readonly now: () => Date;

  constructor(options: HarnessAdapterOptions) {
    this.transport =
      options.transport ?? new OpenCodeProcessTransport({ repositoryRoot: options.repositoryRoot });
    this.now = options.now ?? (() => new Date());
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
      message: "OpenCode/Groq prompt compiled. No harness subprocess was invoked.",
      liveInvocation: false,
    };
  }

  async execute(request: ProviderExecutionRequest): Promise<ProviderExecutionResult> {
    if (!request.resolvedModelId.startsWith("groq/")) {
      throw new ProviderExecutionError(
        this.provider,
        "policy",
        "The PR-0.6 HarnessAdapter scaffold accepts only an explicit groq/<model> identity.",
        false,
      );
    }
    const startedAt = this.now();
    const result = await this.transport.invoke({
      resolvedModelId: request.resolvedModelId,
      prompt: request.prompt,
    });
    try {
      return normalizeOpenCodeResult(result.stdout, request, startedAt, this.now());
    } catch (error) {
      if (error instanceof ProviderExecutionError) throw error;
      throw new ProviderExecutionError(
        this.provider,
        "invalid-response",
        "OpenCode output could not be normalized.",
        false,
      );
    }
  }
}
