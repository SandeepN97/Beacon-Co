import { describe, expect, it } from "vitest";
import {
  CodexCliTransport,
  executeWithClosedStdin,
} from "../../src/modules/orchestration/providers/codex/codex-cli-transport.ts";

describe("Codex CLI transport", () => {
  it("closes piped stdin so the subscription CLI can begin execution", async () => {
    const result = await executeWithClosedStdin(
      process.execPath,
      [
        "-e",
        "process.stdin.resume(); process.stdin.once('end', () => process.stdout.write('stdin-closed'));",
      ],
      { cwd: ".", encoding: "utf8", maxBuffer: 1024, timeout: 1_000 },
    );
    expect(result).toEqual({ stdout: "stdin-closed", stderr: "" });
  });

  it("normalizes JSONL messages and actual usage into the adapter boundary", async () => {
    const execute = async () => ({
      stdout: [
        JSON.stringify({ type: "thread.started", thread_id: "thread-1" }),
        JSON.stringify({
          type: "item.completed",
          item: { type: "agent_message", text: "BEACON_LIVE_OK" },
        }),
        JSON.stringify({
          type: "turn.completed",
          usage: { input_tokens: 12, cached_input_tokens: 4, output_tokens: 3 },
        }),
      ].join("\n"),
      stderr: "",
    });
    const response = await new CodexCliTransport(".", execute).invoke("codex", {
      model: "codex-test",
      input: "test",
    });
    expect(response).toMatchObject({
      id: "thread-1",
      status: "completed",
      model: "codex-test",
      usage: {
        input_tokens: 12,
        input_tokens_details: { cached_tokens: 4 },
        output_tokens: 3,
        total_tokens: 15,
      },
    });
  });

  it("normalizes quota errors without exposing raw stderr", async () => {
    const execute = async () => {
      throw { stderr: "quota exceeded for synthetic account" };
    };
    await expect(
      new CodexCliTransport(".", execute).invoke("codex", {
        model: "codex-test",
        input: "test",
      }),
    ).rejects.toMatchObject({ category: "capacity", retryable: true });
  });

  it("rejects missing usage rather than fabricating metrics", async () => {
    const execute = async () => ({
      stdout: JSON.stringify({
        type: "item.completed",
        item: { type: "agent_message", text: "ok" },
      }),
      stderr: "",
    });
    await expect(
      new CodexCliTransport(".", execute).invoke("codex", {
        model: "codex-test",
        input: "test",
      }),
    ).rejects.toMatchObject({ category: "invalid-response" });
  });
});
