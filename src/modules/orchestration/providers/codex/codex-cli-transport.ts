import { execFile } from "node:child_process";
import { certifyTransportInstance } from "../../execution-budget/trusted-transport.ts";
import { ProviderExecutionError, type ProviderTransport } from "../provider-adapter.ts";

type ExecFile = (
  file: string,
  args: string[],
  options: { cwd: string; encoding: "utf8"; maxBuffer: number; timeout: number },
) => Promise<{ stdout: string; stderr: string }>;

export function executeWithClosedStdin(
  file: string,
  args: string[],
  options: { cwd: string; encoding: "utf8"; maxBuffer: number; timeout: number },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
    child.stdin?.end();
  });
}

const defaultExecFile: ExecFile = executeWithClosedStdin;

function numeric(record: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (Number.isInteger(value) && Number(value) >= 0) return Number(value);
  }
  return null;
}

export class CodexCliTransport implements ProviderTransport {
  private readonly repositoryRoot: string;
  private readonly execute: ExecFile;

  constructor(repositoryRoot: string, execute: ExecFile = defaultExecFile) {
    this.repositoryRoot = repositoryRoot;
    this.execute = execute;
    certifyTransportInstance(this);
  }

  executionBudgetContract() {
    return {
      kind: "opaque" as const,
      reason:
        "Codex CLI cannot prove generation multiplicity, hidden retries, hard cumulative output, or settlement before subprocess execution.",
    };
  }

  async invoke(
    provider: "claude" | "codex",
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (provider !== "codex") {
      throw new ProviderExecutionError(
        provider,
        "policy",
        "Codex CLI transport only supports the Codex adapter.",
        false,
      );
    }
    const model = typeof payload.model === "string" ? payload.model : null;
    const prompt = typeof payload.input === "string" ? payload.input : null;
    if (!model || !prompt) {
      throw new ProviderExecutionError(
        provider,
        "policy",
        "Codex CLI requires explicit model and prompt inputs.",
        false,
      );
    }
    let result: { stdout: string; stderr: string };
    try {
      result = await this.execute(
        "codex",
        [
          "exec",
          "--ephemeral",
          "--ignore-user-config",
          "--sandbox",
          "read-only",
          "--json",
          "--model",
          model,
          "--cd",
          this.repositoryRoot,
          prompt,
        ],
        {
          cwd: this.repositoryRoot,
          encoding: "utf8",
          maxBuffer: 20 * 1024 * 1024,
          timeout: 120_000,
        },
      );
    } catch (error) {
      const stderr =
        error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "";
      if (/rate.?limit|quota|usage.?limit|capacity/i.test(stderr)) {
        throw new ProviderExecutionError(
          provider,
          "capacity",
          "Codex CLI capacity was unavailable.",
          true,
        );
      }
      if (/auth|login|credential|unauthorized/i.test(stderr)) {
        throw new ProviderExecutionError(
          provider,
          "authentication",
          "Codex CLI authentication was unavailable.",
          false,
        );
      }
      throw new ProviderExecutionError(provider, "transient", "Codex CLI execution failed.", true);
    }
    let events: Array<Record<string, unknown>>;
    try {
      events = result.stdout
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, unknown>);
    } catch {
      throw new ProviderExecutionError(
        provider,
        "invalid-response",
        "Codex CLI returned malformed JSONL.",
        false,
      );
    }
    const messages = events.flatMap((event) => {
      const item =
        event.item && typeof event.item === "object"
          ? (event.item as Record<string, unknown>)
          : null;
      return item?.type === "agent_message" && typeof item.text === "string" ? [item.text] : [];
    });
    const completion = [...events].reverse().find((event) => event.type === "turn.completed");
    const usage =
      completion?.usage && typeof completion.usage === "object"
        ? (completion.usage as Record<string, unknown>)
        : {};
    const inputTokens = numeric(usage, "input_tokens", "total_input_tokens");
    const cachedTokens = numeric(usage, "cached_input_tokens", "cached_tokens");
    const outputTokens = numeric(usage, "output_tokens", "total_output_tokens");
    if (inputTokens === null || outputTokens === null) {
      throw new ProviderExecutionError(
        provider,
        "invalid-response",
        "Codex CLI did not report required usage metrics.",
        false,
      );
    }
    return {
      id:
        events.find((event) => event.type === "thread.started")?.thread_id ??
        `codex-cli-${Date.now()}`,
      status: "completed",
      model,
      usage: {
        input_tokens: inputTokens,
        input_tokens_details: { cached_tokens: cachedTokens ?? 0 },
        output_tokens: outputTokens,
        output_tokens_details: {},
        total_tokens: inputTokens + outputTokens,
      },
      output: [{ type: "message", content: [{ type: "output_text", text: messages.join("\n") }] }],
      transport: "codex-cli",
    };
  }
}
