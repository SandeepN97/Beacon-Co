import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { validateAgentRun, type AgentRun } from "../domain/agent-run.ts";
import { type ProviderRun } from "../domain/provider-run.ts";
import { prepareProviderRun } from "./redaction.ts";

export type TelemetryRecordKind = "agent-run" | "provider-run";
export type TelemetrySinkMode = "best-effort" | "required";
export type TelemetryRecord = AgentRun | ProviderRun;

export interface TelemetrySinkResult {
  persisted: boolean;
  kind: TelemetryRecordKind;
  recordId: string | null;
  path: string;
  errorCode: "telemetry-write-failed" | null;
}

export class TelemetryPersistenceError extends Error {
  readonly code = "telemetry-write-failed";
  readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super(message);
    this.name = "TelemetryPersistenceError";
    this.cause = cause;
  }
}

function prepareRecord(kind: TelemetryRecordKind, input: unknown): TelemetryRecord {
  return kind === "agent-run" ? validateAgentRun(input) : prepareProviderRun(input);
}

export class AppendOnlyNdjsonTelemetrySink {
  private readonly paths: Record<TelemetryRecordKind, string>;
  private readonly mode: TelemetrySinkMode;

  constructor(paths: Record<TelemetryRecordKind, string>, mode: TelemetrySinkMode = "best-effort") {
    this.paths = paths;
    this.mode = mode;
  }

  async append(kind: TelemetryRecordKind, input: unknown): Promise<TelemetrySinkResult> {
    const path = this.paths[kind];
    const record = prepareRecord(kind, input);
    try {
      await mkdir(dirname(path), { recursive: true });
      await appendFile(path, `${JSON.stringify(record)}\n`, { encoding: "utf8", mode: 0o600 });
      return {
        persisted: true,
        kind,
        recordId: record.id,
        path,
        errorCode: null,
      };
    } catch (error) {
      if (this.mode === "required") {
        throw new TelemetryPersistenceError(
          `Unable to append ${kind} telemetry to ${path}.`,
          error,
        );
      }
      return {
        persisted: false,
        kind,
        recordId: record.id,
        path,
        errorCode: "telemetry-write-failed",
      };
    }
  }
}

export function createLocalTelemetrySink(
  repositoryRoot: string,
  mode: TelemetrySinkMode = "best-effort",
): AppendOnlyNdjsonTelemetrySink {
  const root = join(repositoryRoot, ".beacon", "telemetry");
  return new AppendOnlyNdjsonTelemetrySink(
    {
      "agent-run": join(root, "agent-runs.ndjson"),
      "provider-run": join(root, "provider-runs.ndjson"),
    },
    mode,
  );
}

export function createCiTelemetrySink(
  repositoryRoot: string,
  mode: TelemetrySinkMode = "best-effort",
): AppendOnlyNdjsonTelemetrySink {
  const root = join(repositoryRoot, "evidence", "telemetry");
  return new AppendOnlyNdjsonTelemetrySink(
    {
      "agent-run": join(root, "agent-runs.ndjson"),
      "provider-run": join(root, "provider-runs.ndjson"),
    },
    mode,
  );
}
