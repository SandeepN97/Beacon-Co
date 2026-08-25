import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "astro/zod";
import type { ProviderId } from "../domain/provider.ts";

const TimestampSchema = z.iso.datetime({ offset: true });
const IdentifierSchema = z.string().min(1).max(160);
const PositiveIntegerSchema = z.number().int().positive();
const NonNegativeIntegerSchema = z.number().int().nonnegative();

export type ExecutionBudgetEvidenceDurability = "process-only" | "fsync-journal";

export const ExecutionBudgetReservationStateSchema = z.enum([
  "PENDING",
  "CANCELLED_BEFORE_INVOCATION",
  "INVOKED",
  "SETTLED_AUTHORITATIVE",
  "SETTLED_CONSERVATIVE",
  "VIOLATION",
]);
export type ExecutionBudgetReservationState = z.infer<typeof ExecutionBudgetReservationStateSchema>;

export const ModelCallKindSchema = z.enum([
  "initial",
  "retry",
  "model-reentry",
  "internal",
  "fallback",
  "handoff",
  "batch",
  "hedge",
  "fan-out",
  "stream",
]);
export type ModelCallKind = z.infer<typeof ModelCallKindSchema>;

export const ExecutionBudgetStopReasonSchema = z.enum([
  "MODEL_CALL_BUDGET_EXHAUSTED",
  "OUTPUT_TOKEN_BUDGET_EXHAUSTED",
  "ENFORCEMENT_VIOLATION",
]);
export type ExecutionBudgetStopReason = z.infer<typeof ExecutionBudgetStopReasonSchema>;

export const ExecutionBudgetLineageSchema = z
  .object({
    budgetLineageId: IdentifierSchema,
    workUnitId: IdentifierSchema,
    maxModelCalls: PositiveIntegerSchema,
    maxOutputTokens: PositiveIntegerSchema,
    authorizedAt: TimestampSchema,
    authorizedBy: IdentifierSchema,
    authorizationEvidenceId: IdentifierSchema,
    allocationKind: z.enum(["top-level", "parent-carve-out", "higher-policy-grant"]),
    parentBudgetLineageId: IdentifierSchema.nullable(),
  })
  .strict()
  .superRefine((lineage, context) => {
    if (lineage.allocationKind === "top-level" && lineage.parentBudgetLineageId !== null) {
      context.addIssue({
        code: "custom",
        message: "A top-level budget lineage cannot claim parent provenance.",
        path: ["parentBudgetLineageId"],
      });
    }
    if (lineage.allocationKind !== "top-level" && lineage.parentBudgetLineageId === null) {
      context.addIssue({
        code: "custom",
        message: "A child allocation requires parent budget provenance.",
        path: ["parentBudgetLineageId"],
      });
    }
  });
export type ExecutionBudgetLineage = Readonly<z.infer<typeof ExecutionBudgetLineageSchema>>;

export interface AuthorizeExecutionBudgetInput {
  budgetLineageId?: string;
  workUnitId: string;
  maxModelCalls: number;
  maxOutputTokens: number;
  authorizedAt: string;
  authorizedBy: string;
  authorizationEvidenceId: string;
  allocationKind?: "top-level" | "parent-carve-out" | "higher-policy-grant";
  parentBudgetLineageId?: string | null;
}

/**
 * This factory is called only by an authorized Beacon orchestration boundary.
 * Provider adapters and transports receive an existing ledger and never call it.
 */
export function authorizeExecutionBudgetLineage(
  input: AuthorizeExecutionBudgetInput,
): ExecutionBudgetLineage {
  return Object.freeze(
    ExecutionBudgetLineageSchema.parse({
      ...input,
      budgetLineageId: input.budgetLineageId ?? `budget-lineage-${randomUUID()}`,
      allocationKind: input.allocationKind ?? "top-level",
      parentBudgetLineageId: input.parentBudgetLineageId ?? null,
    }),
  );
}

const ExecutionBudgetReservationSchema = z
  .object({
    budgetReservationId: IdentifierSchema,
    providerRunId: IdentifierSchema,
    agentRunId: IdentifierSchema,
    provider: z.enum(["claude", "codex"]),
    resolvedModelId: IdentifierSchema,
    kind: ModelCallKindSchema,
    branchIndex: NonNegativeIntegerSchema,
    outputTokenAllowance: PositiveIntegerSchema,
    providerHardCap: PositiveIntegerSchema,
    enforcementOwner: IdentifierSchema,
    providerTransitionFrom: z.enum(["claude", "codex"]).nullable(),
    handoffFrom: IdentifierSchema.nullable(),
    state: ExecutionBudgetReservationStateSchema,
    observedOutputTokens: NonNegativeIntegerSchema.nullable(),
    policyChargedOutputTokens: NonNegativeIntegerSchema,
    latestCumulativeOutputTokens: NonNegativeIntegerSchema.nullable(),
    admittedAt: TimestampSchema,
    invokedAt: TimestampSchema.nullable(),
    settledAt: TimestampSchema.nullable(),
    terminalReason: z.string().min(1).max(240).nullable(),
    settlementFingerprint: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
  })
  .strict();
export type ExecutionBudgetReservation = z.infer<typeof ExecutionBudgetReservationSchema>;

const ExecutionBudgetViolationSchema = z
  .object({
    budgetReservationId: IdentifierSchema,
    reason: z.string().min(1).max(240),
    observedOutputTokens: NonNegativeIntegerSchema.nullable(),
    recordedAt: TimestampSchema,
  })
  .strict();

export const ExecutionBudgetLedgerSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    revision: NonNegativeIntegerSchema,
    recordedAt: TimestampSchema,
    lineage: ExecutionBudgetLineageSchema,
    modelCallsReserved: NonNegativeIntegerSchema,
    modelCallsInitiated: NonNegativeIntegerSchema,
    outputTokensReserved: NonNegativeIntegerSchema,
    observedOutputTokens: NonNegativeIntegerSchema.nullable(),
    policyChargedOutputTokens: NonNegativeIntegerSchema,
    modelCallsRemaining: NonNegativeIntegerSchema,
    outputTokensRemaining: NonNegativeIntegerSchema,
    terminalBudgetReason: ExecutionBudgetStopReasonSchema.nullable(),
    violation: ExecutionBudgetViolationSchema.nullable(),
    reservations: z.array(ExecutionBudgetReservationSchema),
  })
  .strict();
export type ExecutionBudgetLedgerSnapshot = z.infer<typeof ExecutionBudgetLedgerSnapshotSchema>;

export interface ExecutionBudgetEvidenceStore {
  readonly durability: ExecutionBudgetEvidenceDurability;
  append(snapshot: ExecutionBudgetLedgerSnapshot): Promise<void>;
  load(budgetLineageId: string): Promise<ExecutionBudgetLedgerSnapshot[]>;
}

export class InMemoryExecutionBudgetEvidenceStore implements ExecutionBudgetEvidenceStore {
  readonly durability = "process-only" as const;
  readonly snapshots: ExecutionBudgetLedgerSnapshot[] = [];

  async append(snapshot: ExecutionBudgetLedgerSnapshot): Promise<void> {
    this.snapshots.push(structuredClone(ExecutionBudgetLedgerSnapshotSchema.parse(snapshot)));
  }

  async load(budgetLineageId: string): Promise<ExecutionBudgetLedgerSnapshot[]> {
    return this.snapshots
      .filter((snapshot) => snapshot.lineage.budgetLineageId === budgetLineageId)
      .map((snapshot) => structuredClone(snapshot));
  }
}

export class ExecutionBudgetEvidencePersistenceError extends Error {
  readonly code = "execution-budget-evidence-write-failed";
  readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super(message);
    this.name = "ExecutionBudgetEvidencePersistenceError";
    this.cause = cause;
  }
}

/**
 * Reuses Beacon's approved metadata-only append-only NDJSON evidence pattern.
 * Every snapshot is fsync'd before the corresponding provider boundary is crossed.
 */
export class AppendOnlyNdjsonExecutionBudgetEvidenceStore implements ExecutionBudgetEvidenceStore {
  readonly durability = "fsync-journal" as const;

  constructor(readonly path: string) {}

  async append(input: ExecutionBudgetLedgerSnapshot): Promise<void> {
    const snapshot = ExecutionBudgetLedgerSnapshotSchema.parse(input);
    let handle;
    try {
      await mkdir(dirname(this.path), { recursive: true });
      handle = await open(this.path, "a", 0o600);
      await handle.writeFile(`${JSON.stringify(snapshot)}\n`, { encoding: "utf8" });
      await handle.sync();
    } catch (error) {
      throw new ExecutionBudgetEvidencePersistenceError(
        `Unable to persist execution-budget evidence to ${this.path}.`,
        error,
      );
    } finally {
      await handle?.close();
    }
  }

  async load(budgetLineageId: string): Promise<ExecutionBudgetLedgerSnapshot[]> {
    let source: string;
    try {
      source = await readFile(this.path, "utf8");
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        return [];
      }
      throw new ExecutionBudgetEvidencePersistenceError(
        `Unable to read execution-budget evidence from ${this.path}.`,
        error,
      );
    }
    try {
      return source
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => ExecutionBudgetLedgerSnapshotSchema.parse(JSON.parse(line)))
        .filter((snapshot) => snapshot.lineage.budgetLineageId === budgetLineageId);
    } catch (error) {
      throw new ExecutionBudgetEvidencePersistenceError(
        `Execution-budget evidence at ${this.path} is malformed.`,
        error,
      );
    }
  }
}

export function createLocalExecutionBudgetEvidenceStore(
  repositoryRoot: string,
): AppendOnlyNdjsonExecutionBudgetEvidenceStore {
  return new AppendOnlyNdjsonExecutionBudgetEvidenceStore(
    join(repositoryRoot, ".beacon", "telemetry", "execution-budget-ledgers.ndjson"),
  );
}

export function createCiExecutionBudgetEvidenceStore(
  repositoryRoot: string,
): AppendOnlyNdjsonExecutionBudgetEvidenceStore {
  return new AppendOnlyNdjsonExecutionBudgetEvidenceStore(
    join(repositoryRoot, "evidence", "telemetry", "execution-budget-ledgers.ndjson"),
  );
}

export class ExecutionBudgetAdmissionError extends Error {
  readonly reason: ExecutionBudgetStopReason;

  constructor(reason: ExecutionBudgetStopReason, message: string) {
    super(message);
    this.name = "ExecutionBudgetAdmissionError";
    this.reason = reason;
  }
}

export class ExecutionBudgetStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecutionBudgetStateError";
  }
}

function assertSupportedLineageAllocation(lineage: ExecutionBudgetLineage): void {
  if (lineage.allocationKind === "parent-carve-out") {
    throw new ExecutionBudgetStateError(
      "Parent carve-out allocation requires a future parent-ledger reservation mechanism; use the inherited lineage or an explicit higher-policy grant.",
    );
  }
}

export interface ModelCallAdmission {
  providerRunId: string;
  agentRunId: string;
  provider: ProviderId;
  resolvedModelId: string;
  kind: ModelCallKind;
  branchIndex?: number;
  requestedOutputTokenAllowance: number;
  providerHardCap: number;
  enforcementOwner: string;
  providerTransitionFrom?: ProviderId | null;
  handoffFrom?: string | null;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function isTerminal(state: ExecutionBudgetReservationState): boolean {
  return (
    state === "CANCELLED_BEFORE_INVOCATION" ||
    state === "SETTLED_AUTHORITATIVE" ||
    state === "SETTLED_CONSERVATIVE" ||
    state === "VIOLATION"
  );
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ExecutionBudgetAdmissionError(
      "OUTPUT_TOKEN_BUDGET_EXHAUSTED",
      `${label} must be a positive integer.`,
    );
  }
}

export class ExecutionBudgetLedger {
  readonly lineage: ExecutionBudgetLineage;
  private readonly evidenceStore: ExecutionBudgetEvidenceStore;
  private readonly now: () => Date;
  private readonly reservationId: () => string;
  private reservations = new Map<string, ExecutionBudgetReservation>();
  private revision = 0;
  private lastRecordedAt: string;
  private terminalBudgetReason: ExecutionBudgetStopReason | null = null;
  private violation: z.infer<typeof ExecutionBudgetViolationSchema> | null = null;
  private mutationQueue: Promise<void> = Promise.resolve();

  private constructor(
    lineage: ExecutionBudgetLineage,
    evidenceStore: ExecutionBudgetEvidenceStore,
    options: { now?: () => Date; reservationId?: () => string } = {},
  ) {
    this.lineage = Object.freeze(ExecutionBudgetLineageSchema.parse(lineage));
    this.evidenceStore = evidenceStore;
    this.now = options.now ?? (() => new Date());
    this.reservationId = options.reservationId ?? (() => `budget-reservation-${randomUUID()}`);
    this.lastRecordedAt = this.now().toISOString();
  }

  static async create(
    lineage: ExecutionBudgetLineage,
    evidenceStore: ExecutionBudgetEvidenceStore,
    options: { now?: () => Date; reservationId?: () => string } = {},
  ): Promise<ExecutionBudgetLedger> {
    assertSupportedLineageAllocation(lineage);
    const existing = await evidenceStore.load(lineage.budgetLineageId);
    if (existing.length > 0) {
      throw new ExecutionBudgetStateError(
        `Budget lineage ${lineage.budgetLineageId} already has durable state and cannot be reminted.`,
      );
    }
    const ledger = new ExecutionBudgetLedger(lineage, evidenceStore, options);
    await evidenceStore.append(ledger.buildSnapshot());
    return ledger;
  }

  static async recover(
    lineage: ExecutionBudgetLineage,
    evidenceStore: ExecutionBudgetEvidenceStore,
    options: { now?: () => Date; reservationId?: () => string } = {},
  ): Promise<ExecutionBudgetLedger> {
    assertSupportedLineageAllocation(lineage);
    const history = await evidenceStore.load(lineage.budgetLineageId);
    if (history.length === 0) {
      throw new ExecutionBudgetStateError(
        `Budget lineage ${lineage.budgetLineageId} has no durable state to recover.`,
      );
    }
    const byRevision = new Map<number, ExecutionBudgetLedgerSnapshot>();
    for (const snapshot of history) {
      const existing = byRevision.get(snapshot.revision);
      if (existing && JSON.stringify(existing) !== JSON.stringify(snapshot)) {
        throw new ExecutionBudgetStateError(
          `Budget lineage ${lineage.budgetLineageId} has contradictory revision ${snapshot.revision}.`,
        );
      }
      byRevision.set(snapshot.revision, snapshot);
    }
    const revisions = [...byRevision.keys()].sort((left, right) => left - right);
    if (revisions[0] !== 0 || revisions.some((revision, index) => revision !== index)) {
      throw new ExecutionBudgetStateError(
        `Budget lineage ${lineage.budgetLineageId} has a non-contiguous durable history.`,
      );
    }
    const latest = byRevision.get(revisions.at(-1) ?? -1);
    if (!latest || JSON.stringify(latest.lineage) !== JSON.stringify(lineage)) {
      throw new ExecutionBudgetStateError(
        `Budget lineage ${lineage.budgetLineageId} recovery metadata does not match its authority grant.`,
      );
    }
    const ledger = new ExecutionBudgetLedger(lineage, evidenceStore, options);
    ledger.revision = latest.revision;
    ledger.lastRecordedAt = latest.recordedAt;
    ledger.terminalBudgetReason = latest.terminalBudgetReason;
    ledger.violation = latest.violation;
    ledger.reservations = new Map(
      latest.reservations.map((reservation) => [
        reservation.budgetReservationId,
        structuredClone(reservation),
      ]),
    );

    let recovered = false;
    for (const reservation of ledger.reservations.values()) {
      if (reservation.state === "PENDING") {
        reservation.state = "CANCELLED_BEFORE_INVOCATION";
        reservation.settledAt = ledger.now().toISOString();
        reservation.terminalReason = "recovery-proved-invocation-not-started";
        recovered = true;
      } else if (reservation.state === "INVOKED") {
        reservation.state = "SETTLED_CONSERVATIVE";
        reservation.policyChargedOutputTokens = reservation.outputTokenAllowance;
        reservation.settledAt = ledger.now().toISOString();
        reservation.terminalReason = "recovery-after-uncertain-invocation";
        reservation.settlementFingerprint = fingerprint({
          state: reservation.state,
          reason: reservation.terminalReason,
          outputTokenAllowance: reservation.outputTokenAllowance,
        });
        recovered = true;
      }
    }
    if (recovered) await ledger.persistMutation();
    return ledger;
  }

  get budgetLineageId(): string {
    return this.lineage.budgetLineageId;
  }

  get evidenceDurability(): ExecutionBudgetEvidenceDurability {
    return this.evidenceStore.durability;
  }

  snapshot(): ExecutionBudgetLedgerSnapshot {
    return structuredClone(this.buildSnapshot());
  }

  projectProviderRun(providerRunId: string): {
    modelCallsInitiated: number;
    retryCount: number;
    observedOutputTokens: number | null;
    policyChargedOutputTokens: number;
    budgetReservationIds: string[];
  } {
    const reservations = [...this.reservations.values()].filter(
      (reservation) => reservation.providerRunId === providerRunId,
    );
    const initiated = reservations.filter(
      (reservation) =>
        reservation.state !== "PENDING" && reservation.state !== "CANCELLED_BEFORE_INVOCATION",
    );
    const observed = initiated.map((reservation) => reservation.observedOutputTokens);
    return {
      modelCallsInitiated: initiated.length,
      retryCount: initiated.filter((reservation) => reservation.kind === "retry").length,
      observedOutputTokens: observed.some((value) => value === null)
        ? null
        : sum(observed as number[]),
      policyChargedOutputTokens: sum(
        initiated.map((reservation) => reservation.policyChargedOutputTokens),
      ),
      budgetReservationIds: reservations.map((reservation) => reservation.budgetReservationId),
    };
  }

  projectAgentRun(agentRunId: string): {
    modelCallsInitiated: number;
    retryCount: number;
    observedOutputTokens: number | null;
    policyChargedOutputTokens: number;
    providerRunIds: string[];
  } {
    const reservations = [...this.reservations.values()].filter(
      (reservation) => reservation.agentRunId === agentRunId,
    );
    const initiated = reservations.filter(
      (reservation) =>
        reservation.state !== "PENDING" && reservation.state !== "CANCELLED_BEFORE_INVOCATION",
    );
    const observed = initiated.map((reservation) => reservation.observedOutputTokens);
    return {
      modelCallsInitiated: initiated.length,
      retryCount: initiated.filter((reservation) => reservation.kind === "retry").length,
      observedOutputTokens: observed.some((value) => value === null)
        ? null
        : sum(observed as number[]),
      policyChargedOutputTokens: sum(
        initiated.map((reservation) => reservation.policyChargedOutputTokens),
      ),
      providerRunIds: [...new Set(reservations.map((reservation) => reservation.providerRunId))],
    };
  }

  async admitModelCall(input: ModelCallAdmission): Promise<ExecutionBudgetReservation> {
    const [reservation] = await this.admitGenerationBranches([input]);
    if (!reservation)
      throw new ExecutionBudgetStateError("Atomic admission returned no reservation.");
    return reservation;
  }

  async admitGenerationBranches(
    inputs: readonly ModelCallAdmission[],
  ): Promise<ExecutionBudgetReservation[]> {
    if (inputs.length === 0) {
      throw new ExecutionBudgetAdmissionError(
        "MODEL_CALL_BUDGET_EXHAUSTED",
        "At least one model-generation branch is required for admission.",
      );
    }
    for (const input of inputs) {
      assertPositiveInteger(input.requestedOutputTokenAllowance, "Output-token allowance");
      assertPositiveInteger(input.providerHardCap, "Provider hard cap");
      if (input.providerHardCap > input.requestedOutputTokenAllowance) {
        throw new ExecutionBudgetAdmissionError(
          "OUTPUT_TOKEN_BUDGET_EXHAUSTED",
          "Provider hard cap cannot exceed the admitted output-token allowance.",
        );
      }
    }
    return this.runExclusive(async () => {
      if (this.violation) {
        throw new ExecutionBudgetAdmissionError(
          "ENFORCEMENT_VIOLATION",
          "Execution budget lineage is blocked by an enforcement violation.",
        );
      }
      const before = this.buildSnapshot();
      const requestedCalls = inputs.length;
      const requestedTokens = sum(inputs.map((input) => input.requestedOutputTokenAllowance));
      if (requestedCalls > before.modelCallsRemaining) {
        await this.recordDeniedAdmission("MODEL_CALL_BUDGET_EXHAUSTED");
        throw new ExecutionBudgetAdmissionError(
          "MODEL_CALL_BUDGET_EXHAUSTED",
          "Model-call budget is exhausted.",
        );
      }
      if (requestedTokens > before.outputTokensRemaining) {
        await this.recordDeniedAdmission("OUTPUT_TOKEN_BUDGET_EXHAUSTED");
        throw new ExecutionBudgetAdmissionError(
          "OUTPUT_TOKEN_BUDGET_EXHAUSTED",
          "Output-token budget is exhausted.",
        );
      }
      const admittedAt = this.now().toISOString();
      this.terminalBudgetReason = null;
      const reservations = inputs.map((input, index) =>
        ExecutionBudgetReservationSchema.parse({
          budgetReservationId: this.reservationId(),
          providerRunId: input.providerRunId,
          agentRunId: input.agentRunId,
          provider: input.provider,
          resolvedModelId: input.resolvedModelId,
          kind: input.kind,
          branchIndex: input.branchIndex ?? index,
          outputTokenAllowance: input.requestedOutputTokenAllowance,
          providerHardCap: input.providerHardCap,
          enforcementOwner: input.enforcementOwner,
          providerTransitionFrom: input.providerTransitionFrom ?? null,
          handoffFrom: input.handoffFrom ?? null,
          state: "PENDING",
          observedOutputTokens: null,
          policyChargedOutputTokens: 0,
          latestCumulativeOutputTokens: null,
          admittedAt,
          invokedAt: null,
          settledAt: null,
          terminalReason: null,
          settlementFingerprint: null,
        }),
      );
      if (
        new Set(reservations.map(({ budgetReservationId }) => budgetReservationId)).size !==
        reservations.length
      ) {
        throw new ExecutionBudgetStateError("Budget reservation identities must be unique.");
      }
      for (const reservation of reservations) {
        if (this.reservations.has(reservation.budgetReservationId)) {
          throw new ExecutionBudgetStateError(
            `Budget reservation ${reservation.budgetReservationId} already exists.`,
          );
        }
        this.reservations.set(reservation.budgetReservationId, reservation);
      }
      try {
        await this.persistMutation();
      } catch (error) {
        for (const reservation of reservations) {
          this.reservations.delete(reservation.budgetReservationId);
        }
        throw error;
      }
      return reservations.map((reservation) => structuredClone(reservation));
    });
  }

  async cancelBeforeInvocation(budgetReservationId: string, reason: string): Promise<void> {
    await this.transition(budgetReservationId, (reservation) => {
      if (reservation.state === "CANCELLED_BEFORE_INVOCATION") return false;
      if (reservation.state !== "PENDING") {
        throw new ExecutionBudgetStateError(
          `Reservation ${budgetReservationId} cannot prove pre-invocation cancellation from ${reservation.state}.`,
        );
      }
      reservation.state = "CANCELLED_BEFORE_INVOCATION";
      reservation.settledAt = this.now().toISOString();
      reservation.terminalReason = reason;
      return true;
    });
  }

  async markInvoked(budgetReservationId: string): Promise<void> {
    await this.transition(budgetReservationId, (reservation) => {
      if (reservation.state === "INVOKED") return false;
      if (reservation.state !== "PENDING") {
        throw new ExecutionBudgetStateError(
          `Reservation ${budgetReservationId} cannot be invoked from ${reservation.state}.`,
        );
      }
      reservation.state = "INVOKED";
      reservation.invokedAt = this.now().toISOString();
      return true;
    });
  }

  async observeStreamingCumulativeUsage(
    budgetReservationId: string,
    cumulativeOutputTokens: unknown,
  ): Promise<void> {
    if (!Number.isInteger(cumulativeOutputTokens) || Number(cumulativeOutputTokens) < 0) {
      throw new ExecutionBudgetStateError(
        "Streaming cumulative output usage must be a non-negative integer.",
      );
    }
    const observed = Number(cumulativeOutputTokens);
    await this.runExclusive(async () => {
      const reservation = this.requireReservation(budgetReservationId);
      if (reservation.state !== "INVOKED") {
        throw new ExecutionBudgetStateError(
          `Reservation ${budgetReservationId} cannot record streaming usage from ${reservation.state}.`,
        );
      }
      if (observed > reservation.outputTokenAllowance || observed > reservation.providerHardCap) {
        this.applyViolation(reservation, observed, "streaming-output-exceeded-hard-cap");
        await this.persistMutation();
        return;
      }
      if (
        reservation.latestCumulativeOutputTokens !== null &&
        observed < reservation.latestCumulativeOutputTokens
      ) {
        reservation.state = "SETTLED_CONSERVATIVE";
        reservation.observedOutputTokens = null;
        reservation.policyChargedOutputTokens = reservation.outputTokenAllowance;
        reservation.settledAt = this.now().toISOString();
        reservation.terminalReason = "contradictory-streaming-cumulative-usage";
        reservation.settlementFingerprint = fingerprint({
          state: reservation.state,
          reason: reservation.terminalReason,
        });
        await this.persistMutation();
        return;
      }
      if (reservation.latestCumulativeOutputTokens === observed) return;
      reservation.latestCumulativeOutputTokens = observed;
      await this.persistMutation();
    });
  }

  async settleAuthoritative(
    budgetReservationId: string,
    observedOutputTokens: unknown,
  ): Promise<ExecutionBudgetReservationState> {
    const reservation = this.requireReservation(budgetReservationId);
    if (!Number.isInteger(observedOutputTokens) || Number(observedOutputTokens) < 0) {
      await this.settleConservative(
        budgetReservationId,
        null,
        "invalid-or-unsupported-authoritative-usage",
      );
      return "SETTLED_CONSERVATIVE";
    }
    const observed = Number(observedOutputTokens);
    if (observed > reservation.outputTokenAllowance || observed > reservation.providerHardCap) {
      await this.settleViolation(
        budgetReservationId,
        observed,
        "observed-output-exceeded-hard-cap",
      );
      return "VIOLATION";
    }
    if (
      reservation.latestCumulativeOutputTokens !== null &&
      observed < reservation.latestCumulativeOutputTokens
    ) {
      await this.settleConservative(
        budgetReservationId,
        null,
        "terminal-usage-contradicts-streaming-cumulative-usage",
      );
      return "SETTLED_CONSERVATIVE";
    }
    const settlementFingerprint = fingerprint({ state: "SETTLED_AUTHORITATIVE", observed });
    await this.transitionTerminal(budgetReservationId, settlementFingerprint, (current) => {
      current.state = "SETTLED_AUTHORITATIVE";
      current.observedOutputTokens = observed;
      current.policyChargedOutputTokens = observed;
      current.settledAt = this.now().toISOString();
      current.terminalReason = "authoritative-terminal-usage";
      current.settlementFingerprint = settlementFingerprint;
    });
    return "SETTLED_AUTHORITATIVE";
  }

  async settleConservative(
    budgetReservationId: string,
    observedOutputTokens: number | null,
    reason: string,
  ): Promise<void> {
    const reservation = this.requireReservation(budgetReservationId);
    const observed =
      observedOutputTokens !== null &&
      Number.isInteger(observedOutputTokens) &&
      observedOutputTokens >= 0
        ? observedOutputTokens
        : null;
    if (
      observed !== null &&
      (observed > reservation.outputTokenAllowance || observed > reservation.providerHardCap)
    ) {
      await this.settleViolation(budgetReservationId, observed, reason);
      return;
    }
    const settlementFingerprint = fingerprint({
      state: "SETTLED_CONSERVATIVE",
      observed,
      reason,
    });
    await this.transitionTerminal(budgetReservationId, settlementFingerprint, (current) => {
      current.state = "SETTLED_CONSERVATIVE";
      current.observedOutputTokens = observed;
      current.policyChargedOutputTokens = current.outputTokenAllowance;
      current.settledAt = this.now().toISOString();
      current.terminalReason = reason;
      current.settlementFingerprint = settlementFingerprint;
    });
  }

  async settleViolation(
    budgetReservationId: string,
    observedOutputTokens: number | null,
    reason: string,
  ): Promise<void> {
    const observed =
      observedOutputTokens !== null &&
      Number.isInteger(observedOutputTokens) &&
      observedOutputTokens >= 0
        ? observedOutputTokens
        : null;
    const settlementFingerprint = fingerprint({ state: "VIOLATION", observed, reason });
    await this.runExclusive(async () => {
      const reservation = this.requireReservation(budgetReservationId);
      if (
        reservation.settlementFingerprint === settlementFingerprint &&
        reservation.state === "VIOLATION"
      ) {
        return;
      }
      if (reservation.state === "PENDING") {
        throw new ExecutionBudgetStateError(
          `Reservation ${budgetReservationId} cannot record a provider violation before invocation.`,
        );
      }
      this.applyViolation(reservation, observed, reason, settlementFingerprint);
      await this.persistMutation();
    });
  }

  private applyViolation(
    reservation: ExecutionBudgetReservation,
    observedOutputTokens: number | null,
    reason: string,
    settlementFingerprint = fingerprint({
      state: "VIOLATION",
      observed: observedOutputTokens,
      reason,
    }),
  ): void {
    reservation.state = "VIOLATION";
    reservation.observedOutputTokens = observedOutputTokens;
    reservation.policyChargedOutputTokens = reservation.outputTokenAllowance;
    reservation.settledAt = this.now().toISOString();
    reservation.terminalReason = reason;
    reservation.settlementFingerprint = settlementFingerprint;
    this.terminalBudgetReason = "ENFORCEMENT_VIOLATION";
    this.violation = {
      budgetReservationId: reservation.budgetReservationId,
      reason,
      observedOutputTokens,
      recordedAt: this.now().toISOString(),
    };
  }

  private async transitionTerminal(
    budgetReservationId: string,
    settlementFingerprint: string,
    mutate: (reservation: ExecutionBudgetReservation) => void,
  ): Promise<void> {
    await this.runExclusive(async () => {
      const reservation = this.requireReservation(budgetReservationId);
      if (isTerminal(reservation.state)) {
        if (reservation.settlementFingerprint === settlementFingerprint) return;
        reservation.state = "VIOLATION";
        reservation.policyChargedOutputTokens = Math.max(
          reservation.policyChargedOutputTokens,
          reservation.outputTokenAllowance,
        );
        reservation.settledAt = this.now().toISOString();
        reservation.terminalReason = "contradictory-duplicate-settlement";
        reservation.settlementFingerprint = fingerprint({
          previous: reservation.settlementFingerprint,
          contradictory: settlementFingerprint,
        });
        this.terminalBudgetReason = "ENFORCEMENT_VIOLATION";
        this.violation = {
          budgetReservationId,
          reason: "contradictory-duplicate-settlement",
          observedOutputTokens: reservation.observedOutputTokens,
          recordedAt: this.now().toISOString(),
        };
        await this.persistMutation();
        return;
      }
      if (reservation.state !== "INVOKED") {
        throw new ExecutionBudgetStateError(
          `Reservation ${budgetReservationId} cannot settle from ${reservation.state}.`,
        );
      }
      mutate(reservation);
      await this.persistMutation();
    });
  }

  private async transition(
    budgetReservationId: string,
    mutate: (reservation: ExecutionBudgetReservation) => boolean,
  ): Promise<void> {
    await this.runExclusive(async () => {
      const reservation = this.requireReservation(budgetReservationId);
      if (mutate(reservation)) await this.persistMutation();
    });
  }

  private requireReservation(budgetReservationId: string): ExecutionBudgetReservation {
    const reservation = this.reservations.get(budgetReservationId);
    if (!reservation) {
      throw new ExecutionBudgetStateError(`Unknown budget reservation ${budgetReservationId}.`);
    }
    return reservation;
  }

  private async recordDeniedAdmission(reason: ExecutionBudgetStopReason): Promise<void> {
    this.terminalBudgetReason = reason;
    await this.persistMutation();
  }

  private async persistMutation(): Promise<void> {
    const previousRecordedAt = this.lastRecordedAt;
    this.revision += 1;
    this.lastRecordedAt = this.now().toISOString();
    try {
      await this.evidenceStore.append(this.buildSnapshot());
    } catch (error) {
      this.revision -= 1;
      this.lastRecordedAt = previousRecordedAt;
      throw error;
    }
  }

  private runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.mutationQueue.then(operation, operation);
    this.mutationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private buildSnapshot(): ExecutionBudgetLedgerSnapshot {
    const reservations = [...this.reservations.values()].map((reservation) =>
      structuredClone(reservation),
    );
    const pending = reservations.filter((reservation) => reservation.state === "PENDING");
    const invoked = reservations.filter((reservation) => reservation.state === "INVOKED");
    const initiated = reservations.filter(
      (reservation) =>
        reservation.state !== "PENDING" && reservation.state !== "CANCELLED_BEFORE_INVOCATION",
    );
    const observed = initiated.map((reservation) => reservation.observedOutputTokens);
    const policyChargedOutputTokens = sum(
      initiated.map((reservation) => reservation.policyChargedOutputTokens),
    );
    const outputTokensReserved = sum(
      [...pending, ...invoked].map((reservation) => reservation.outputTokenAllowance),
    );
    const modelCallsRemaining = Math.max(
      0,
      this.lineage.maxModelCalls - initiated.length - pending.length,
    );
    const outputTokensRemaining = Math.max(
      0,
      this.lineage.maxOutputTokens - policyChargedOutputTokens - outputTokensReserved,
    );
    return ExecutionBudgetLedgerSnapshotSchema.parse({
      schemaVersion: 1,
      revision: this.revision,
      recordedAt: this.lastRecordedAt,
      lineage: this.lineage,
      modelCallsReserved: pending.length,
      modelCallsInitiated: initiated.length,
      outputTokensReserved,
      observedOutputTokens: observed.some((value) => value === null)
        ? null
        : sum(observed as number[]),
      policyChargedOutputTokens,
      modelCallsRemaining,
      outputTokensRemaining,
      terminalBudgetReason: this.terminalBudgetReason,
      violation: this.violation,
      reservations,
    });
  }
}

export function resolveProviderModelCallLimit(input: {
  maxModelCalls?: number;
  legacyMaxTurns?: number;
}): number {
  const { maxModelCalls, legacyMaxTurns } = input;
  if (maxModelCalls === undefined && legacyMaxTurns === undefined) {
    throw new ExecutionBudgetStateError(
      "Provider execution requires canonical maxModelCalls or the legacy maxTurns alias.",
    );
  }
  if (maxModelCalls !== undefined && (!Number.isInteger(maxModelCalls) || maxModelCalls <= 0)) {
    throw new ExecutionBudgetStateError("maxModelCalls must be a positive integer.");
  }
  if (legacyMaxTurns !== undefined && (!Number.isInteger(legacyMaxTurns) || legacyMaxTurns <= 0)) {
    throw new ExecutionBudgetStateError("Legacy maxTurns must be a positive integer.");
  }
  if (
    maxModelCalls !== undefined &&
    legacyMaxTurns !== undefined &&
    maxModelCalls !== legacyMaxTurns
  ) {
    throw new ExecutionBudgetStateError(
      "Legacy maxTurns must map exactly to canonical maxModelCalls at the provider boundary.",
    );
  }
  return maxModelCalls ?? (legacyMaxTurns as number);
}
