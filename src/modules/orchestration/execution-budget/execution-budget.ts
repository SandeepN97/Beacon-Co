import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "astro/zod";
import type { ProviderId } from "../domain/provider.ts";
import type { ExecutionBudgetAuthorityGrant } from "./authority-grant.ts";
import {
  ExecutionBudgetWriterFenceError,
  ExecutionBudgetWriterLease,
  ExecutionBudgetWriterLeaseUnavailableError,
  readCurrentWriterPointer,
  withWriterAuthorityLock,
  type ExecutionBudgetWriterLeaseTestHooks,
} from "./writer-lease.ts";

export { ExecutionBudgetWriterFenceError, ExecutionBudgetWriterLeaseUnavailableError };
export { ExecutionBudgetWriterLease } from "./writer-lease.ts";
export {
  ExecutionBudgetAuthorityGrant,
  ExecutionBudgetAuthorityGrantError,
  type ExecutionBudgetAuthorityGrantInput,
} from "./authority-grant.ts";

const TimestampSchema = z.iso.datetime({ offset: true });
const IdentifierSchema = z.string().min(1).max(160);
const PositiveIntegerSchema = z.number().int().positive();
const NonNegativeIntegerSchema = z.number().int().nonnegative();
const Sha256HexSchema = z.string().regex(/^[a-f0-9]{64}$/);

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

export const RemoteInvocationStateSchema = z.enum(["NOT_STARTED", "UNRESOLVED", "TERMINAL"]);
export type RemoteInvocationState = z.infer<typeof RemoteInvocationStateSchema>;

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

/**
 * B2 rereview fix (independent rereview of PR #83, candidate
 * 225384030a4a30d66c946bdbc0d577a057a8a0c6): the previous correction gated
 * capacity minting at `authorizeExecutionBudgetLineage`, but exported the raw
 * `ExecutionBudgetLineageSchema` validator with nothing stopping any other
 * module from calling `.parse()` on a hand-built object and handing the
 * result straight to `ExecutionBudgetLedger.create()`/`.recover()` -- which
 * accepted any structurally valid lineage with no provenance check at all.
 * A reviewer confirmed this with a working exploit.
 *
 * This module-private `WeakSet` is the non-forgeable brand this needed: only
 * `authorizeExecutionBudgetLineage` (below) ever adds to it, and
 * `ExecutionBudgetLedger.create`/`.recover` refuse any lineage that is not a
 * member, before doing anything else (including acquiring a writer lease).
 * The schema itself is intentionally NOT exported -- nothing outside this
 * file has ever needed it (verified: no other module imports it), and not
 * exporting it removes the easiest way to reach for `.parse()` directly.
 */
const authorizedLineages = new WeakSet<object>();

function assertLineageIsAuthorized(lineage: ExecutionBudgetLineage): void {
  if (!authorizedLineages.has(lineage)) {
    throw new ExecutionBudgetStateError(
      "This execution-budget lineage was not produced by authorizeExecutionBudgetLineage(); " +
        "refusing to mint a ledger from an unauthorized or hand-constructed lineage object.",
    );
  }
}

const ExecutionBudgetLineageSchema = z
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
  /**
   * B2 fix (independent security review of PR #83, candidate
   * e895f60e72f912221b7bf9d001d8aa49bdd993eb): the only way to obtain a grant
   * is `ExecutionBudgetAuthorityGrant.issue(...)`, which itself requires the
   * canonical Decision OS authority boundary (`assertExecutionAuthorized`) to
   * accept an accepted AdrRef bound to a real, committed ADR document. Bare
   * `authorizedBy`/`authorizationEvidenceId` strings are no longer accepted.
   */
  grant: ExecutionBudgetAuthorityGrant;
  allocationKind?: "top-level" | "parent-carve-out" | "higher-policy-grant";
  parentBudgetLineageId?: string | null;
}

/**
 * This factory is called only by an authorized Beacon orchestration boundary.
 * Provider adapters and transports receive an existing ledger and never call it.
 * Unlike the pre-correction version, it cannot mint capacity from caller-supplied
 * strings: every field describing *what* was authorized (WorkUnit, ceilings) is
 * read from the trusted `grant`, not from `input` directly.
 */
export function authorizeExecutionBudgetLineage(
  input: AuthorizeExecutionBudgetInput,
): ExecutionBudgetLineage {
  const { grant } = input;
  const lineage = Object.freeze(
    ExecutionBudgetLineageSchema.parse({
      budgetLineageId: input.budgetLineageId ?? `budget-lineage-${randomUUID()}`,
      workUnitId: grant.workUnitId,
      maxModelCalls: grant.maxModelCalls,
      maxOutputTokens: grant.maxOutputTokens,
      authorizedAt: grant.grantedAt,
      authorizedBy: grant.adrRef.adrId,
      authorizationEvidenceId: grant.authorizationEvidenceId,
      allocationKind: input.allocationKind ?? "top-level",
      parentBudgetLineageId: input.parentBudgetLineageId ?? null,
    }),
  );
  authorizedLineages.add(lineage);
  return lineage;
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
    /** Accounting settlement and remote provider termination are independent facts. */
    remoteInvocationState: RemoteInvocationStateSchema,
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

// Not exported: nothing outside this file needs the raw validator, and a
// reviewer showed that exporting it let arbitrary code fabricate a snapshot
// and hand it straight to AppendOnlyNdjsonExecutionBudgetEvidenceStore.append()
// (which now also verifies the current writer fence -- see append() below).
const ExecutionBudgetLedgerSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    revision: NonNegativeIntegerSchema,
    recordedAt: TimestampSchema,
    lineage: ExecutionBudgetLineageSchema,
    /** Identity of the writer that produced this revision (see writer-lease.ts). */
    writerLeaseId: z.string().min(1).max(200),
    /** Monotonic fence for that writer identity; a takeover always increases it. */
    writerFence: PositiveIntegerSchema,
    /** sha256 of the previous revision's contentHash; null only for revision 0. */
    previousContentHash: Sha256HexSchema.nullable(),
    /** sha256 over this record's own content (every field except this one). */
    contentHash: Sha256HexSchema,
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

function canonicalContentHash(
  snapshot: Omit<ExecutionBudgetLedgerSnapshot, "contentHash">,
): string {
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

export interface ExecutionBudgetEvidenceStore {
  readonly durability: ExecutionBudgetEvidenceDurability;
  append(snapshot: ExecutionBudgetLedgerSnapshot): Promise<void>;
  load(budgetLineageId: string): Promise<ExecutionBudgetLedgerSnapshot[]>;
  /**
   * Cross-process exclusive-writer acquisition (B1 fix). Stores whose
   * durability is inherently single-process (e.g. in-memory) may omit this;
   * the ledger then relies on its existing in-process mutation queue only,
   * which is already sufficient because nothing outside that one process can
   * see the store.
   */
  acquireWriterLease?(budgetLineageId: string): Promise<ExecutionBudgetWriterLease>;
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

/** Deterministic, path-safe per-lineage directory name (Section 7). */
export function hashLineagePath(budgetLineageId: string): string {
  return createHash("sha256").update(budgetLineageId).digest("hex");
}

async function assertNotSymlink(path: string): Promise<void> {
  let stats;
  try {
    stats = await lstat(path);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
  if (stats.isSymbolicLink()) {
    throw new ExecutionBudgetEvidencePersistenceError(
      `Refusing to use ${path}: execution-budget evidence paths must not be symlinks.`,
      new Error("symlink-rejected"),
    );
  }
}

/**
 * Reuses Beacon's approved metadata-only append-only NDJSON evidence pattern,
 * hardened per the independent security review of PR #83 (candidate
 * e895f60e72f912221b7bf9d001d8aa49bdd993eb):
 *
 *  - one authoritative journal PER LINEAGE, addressed by a hash of the lineage
 *    id rather than a raw untrusted path segment (Section 7);
 *  - an exclusive writer lease + monotonic fence lives alongside that journal
 *    and gates every mutation and every provider invocation (Section 3-5);
 *  - the journal directory and file are owner-only (0700/0600) and symlinked
 *    replacement is rejected where the platform can prove it (Section 10);
 *  - every snapshot is fsync'd before the corresponding provider boundary is
 *    crossed, and a write/fsync/close failure is never silently downgraded.
 */
export class AppendOnlyNdjsonExecutionBudgetEvidenceStore implements ExecutionBudgetEvidenceStore {
  readonly durability = "fsync-journal" as const;
  readonly rootDir: string;
  private readonly writerLeaseOptions: {
    ttlMs?: number;
    now?: () => Date;
    testHooks?: ExecutionBudgetWriterLeaseTestHooks & {
      /** Deterministic race barrier used only by adversarial tests. */
      beforeAppendJournalWrite?(snapshot: ExecutionBudgetLedgerSnapshot): Promise<void>;
    };
  };

  constructor(
    rootDir: string,
    writerLeaseOptions: {
      ttlMs?: number;
      now?: () => Date;
      testHooks?: ExecutionBudgetWriterLeaseTestHooks & {
        beforeAppendJournalWrite?(snapshot: ExecutionBudgetLedgerSnapshot): Promise<void>;
      };
    } = {},
  ) {
    this.rootDir = rootDir;
    this.writerLeaseOptions = writerLeaseOptions;
  }

  private lineageDir(budgetLineageId: string): string {
    return join(this.rootDir, hashLineagePath(budgetLineageId));
  }

  private journalPath(budgetLineageId: string): string {
    return join(this.lineageDir(budgetLineageId), "journal.ndjson");
  }

  async acquireWriterLease(budgetLineageId: string): Promise<ExecutionBudgetWriterLease> {
    return ExecutionBudgetWriterLease.acquire({
      dir: join(this.lineageDir(budgetLineageId), "writer"),
      ttlMs: this.writerLeaseOptions.ttlMs,
      now: this.writerLeaseOptions.now,
      testHooks: this.writerLeaseOptions.testHooks,
    });
  }

  async append(input: ExecutionBudgetLedgerSnapshot): Promise<void> {
    const snapshot = ExecutionBudgetLedgerSnapshotSchema.parse(input);
    const dir = this.lineageDir(snapshot.lineage.budgetLineageId);
    const path = this.journalPath(snapshot.lineage.budgetLineageId);
    try {
      await mkdir(dir, { recursive: true, mode: 0o700 });
      await withWriterAuthorityLock(join(dir, "writer"), async () => {
        // Fence validation and the fsync-backed append are one indivisible
        // authority operation. A takeover therefore happens wholly before
        // this append (which rejects) or wholly after it (when it was still
        // authoritative), never between the check and write.
        const currentPointer = await readCurrentWriterPointer(join(dir, "writer"));
        if (
          !currentPointer ||
          currentPointer.writerLeaseId !== snapshot.writerLeaseId ||
          currentPointer.fence !== snapshot.writerFence
        ) {
          throw new ExecutionBudgetEvidencePersistenceError(
            `Refusing to append a snapshot for ${snapshot.lineage.budgetLineageId} whose writer identity does not match the currently active lease.`,
            new ExecutionBudgetWriterFenceError("append() fence mismatch"),
          );
        }
        await assertNotSymlink(path);
        await this.writerLeaseOptions.testHooks?.beforeAppendJournalWrite?.(snapshot);
        const handle = await open(path, "a", 0o600);
        let writeError: unknown;
        try {
          await handle.writeFile(`${JSON.stringify(snapshot)}\n`, { encoding: "utf8" });
          await handle.sync();
        } catch (error) {
          writeError = error;
        }
        let closeError: unknown;
        try {
          await handle.close();
        } catch (error) {
          closeError = error;
        }
        if (writeError) throw writeError;
        if (closeError) {
          throw new ExecutionBudgetEvidencePersistenceError(
            `Unable to durably close the execution-budget journal at ${path}; treating as an uncertain write.`,
            closeError,
          );
        }
      });
    } catch (error) {
      if (error instanceof ExecutionBudgetEvidencePersistenceError) throw error;
      throw new ExecutionBudgetEvidencePersistenceError(
        `Unable to persist execution-budget evidence to ${path}.`,
        error,
      );
    }
  }

  async load(budgetLineageId: string): Promise<ExecutionBudgetLedgerSnapshot[]> {
    const path = this.journalPath(budgetLineageId);
    let source: string;
    try {
      source = await readFile(path, "utf8");
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        return [];
      }
      throw new ExecutionBudgetEvidencePersistenceError(
        `Unable to read execution-budget evidence from ${path}.`,
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
        `Execution-budget evidence at ${path} is malformed or truncated; refusing to repair it silently.`,
        error,
      );
    }
  }
}

export function createLocalExecutionBudgetEvidenceStore(
  repositoryRoot: string,
): AppendOnlyNdjsonExecutionBudgetEvidenceStore {
  return new AppendOnlyNdjsonExecutionBudgetEvidenceStore(
    join(repositoryRoot, ".beacon", "telemetry", "execution-budgets"),
  );
}

export function createCiExecutionBudgetEvidenceStore(
  repositoryRoot: string,
): AppendOnlyNdjsonExecutionBudgetEvidenceStore {
  return new AppendOnlyNdjsonExecutionBudgetEvidenceStore(
    join(repositoryRoot, "evidence", "telemetry", "execution-budgets"),
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

export class ExecutionBudgetUnresolvedRemoteInvocationError extends ExecutionBudgetStateError {
  constructor() {
    super(
      "An unresolved remote invocation remains on this execution-budget lineage; " +
        "automatic provider re-execution is blocked pending governed handling.",
    );
    this.name = "ExecutionBudgetUnresolvedRemoteInvocationError";
  }
}

/**
 * B4/B5 fix: once a durable-persistence outcome becomes uncertain (an append,
 * fsync, or close failed and Beacon cannot know whether bytes reached durable
 * storage), the ledger poisons itself permanently. No further admission,
 * settlement, or invocation may proceed from ambiguous memory; a fresh,
 * governed `ExecutionBudgetLedger.recover()` against durable evidence is the
 * only way forward.
 */
export class ExecutionBudgetPoisonedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecutionBudgetPoisonedError";
  }
}

function assertSupportedLineageAllocation(lineage: ExecutionBudgetLineage): void {
  if (lineage.allocationKind === "parent-carve-out") {
    throw new ExecutionBudgetStateError(
      "Parent carve-out allocation requires a future parent-ledger reservation mechanism; use the inherited lineage or an explicit higher-policy grant.",
    );
  }
  if (lineage.allocationKind === "higher-policy-grant") {
    throw new ExecutionBudgetStateError(
      "Higher-policy-grant allocation has no proven capacity-minting mechanism in the current " +
        "Phase 1.5 runtime; failing closed rather than trusting caller-provided grant metadata.",
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

/** Mutable working copy of ledger state a single transaction mutates before commit. */
interface LedgerDraft {
  reservations: Map<string, ExecutionBudgetReservation>;
  terminalBudgetReason: ExecutionBudgetStopReason | null;
  violation: z.infer<typeof ExecutionBudgetViolationSchema> | null;
}

interface MutationOutcome<T> {
  /** false skips persistence entirely -- true idempotent no-ops (Section 42/N2). */
  changed: boolean;
  value: T;
}

/**
 * B1/B4 rereview fix (independent rereview of PR #83, candidate
 * 225384030a4a30d66c946bdbc0d577a057a8a0c6): TypeScript's `private constructor`
 * is a compile-time-only annotation -- it does not exist at runtime, and this
 * repository's own scripts run `.ts` files via `--experimental-strip-types`,
 * which performs no type-checking at all. A reviewer confirmed with a working
 * exploit that `new ExecutionBudgetLedger(...)` could be called directly,
 * bypassing `create()`/`recover()` entirely -- including the writer-lease
 * acquisition (B1) and the "already has durable state" check.
 *
 * A `Symbol` created once here and never exported is unforgeable from outside
 * this module: no external code can produce a value `===` to it. The
 * constructor refuses to run unless it receives this exact token, so
 * `create()`/`recover()` (the only two places that hold it) are the only real
 * construction paths, enforced by the language runtime rather than by
 * convention.
 */
const LEDGER_CONSTRUCTOR_TOKEN = Symbol("execution-budget-ledger-constructor-token");

export class ExecutionBudgetLedger {
  readonly lineage: ExecutionBudgetLineage;
  private readonly evidenceStore: ExecutionBudgetEvidenceStore;
  private readonly now: () => Date;
  private readonly reservationId: () => string;
  private readonly writerLease: ExecutionBudgetWriterLease | null;
  private reservations = new Map<string, ExecutionBudgetReservation>();
  // -1 so the first durable commit (create()'s initial snapshot) lands on
  // revision 0, matching recover()'s expectation that history starts there.
  private revision = -1;
  private lastSnapshot: ExecutionBudgetLedgerSnapshot | null = null;
  private terminalBudgetReason: ExecutionBudgetStopReason | null = null;
  private violation: z.infer<typeof ExecutionBudgetViolationSchema> | null = null;
  private mutationQueue: Promise<void> = Promise.resolve();
  private poisoned = false;
  private poisonReason: string | null = null;

  private constructor(
    token: symbol,
    lineage: ExecutionBudgetLineage,
    evidenceStore: ExecutionBudgetEvidenceStore,
    writerLease: ExecutionBudgetWriterLease | null,
    options: { now?: () => Date; reservationId?: () => string } = {},
  ) {
    if (token !== LEDGER_CONSTRUCTOR_TOKEN) {
      throw new ExecutionBudgetStateError(
        "ExecutionBudgetLedger cannot be constructed directly; use create() or recover().",
      );
    }
    assertLineageIsAuthorized(lineage);
    this.lineage = Object.freeze(ExecutionBudgetLineageSchema.parse(lineage));
    this.evidenceStore = evidenceStore;
    this.writerLease = writerLease;
    this.now = options.now ?? (() => new Date());
    this.reservationId = options.reservationId ?? (() => `budget-reservation-${randomUUID()}`);
  }

  static async create(
    lineage: ExecutionBudgetLineage,
    evidenceStore: ExecutionBudgetEvidenceStore,
    options: { now?: () => Date; reservationId?: () => string } = {},
  ): Promise<ExecutionBudgetLedger> {
    assertSupportedLineageAllocation(lineage);
    // B1 fix: acquire exclusive writer ownership BEFORE any durable read, so a
    // concurrent create() and a concurrent recover() for the same lineage race
    // on the SAME atomic primitive rather than on separate, unprotected steps.
    const writerLease = (await evidenceStore.acquireWriterLease?.(lineage.budgetLineageId)) ?? null;
    const existing = await evidenceStore.load(lineage.budgetLineageId);
    if (existing.length > 0) {
      throw new ExecutionBudgetStateError(
        `Budget lineage ${lineage.budgetLineageId} already has durable state and cannot be reminted.`,
      );
    }
    const ledger = new ExecutionBudgetLedger(
      LEDGER_CONSTRUCTOR_TOKEN,
      lineage,
      evidenceStore,
      writerLease,
      options,
    );
    await ledger.persistInitialSnapshot();
    return ledger;
  }

  static async recover(
    lineage: ExecutionBudgetLineage,
    evidenceStore: ExecutionBudgetEvidenceStore,
    options: { now?: () => Date; reservationId?: () => string } = {},
  ): Promise<ExecutionBudgetLedger> {
    assertSupportedLineageAllocation(lineage);
    const writerLease = (await evidenceStore.acquireWriterLease?.(lineage.budgetLineageId)) ?? null;
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
    let previousHash: string | null = null;
    let previousWriterFence = 0;
    let previousWriterLeaseId: string | null = null;
    for (const revision of revisions) {
      const record = byRevision.get(revision);
      if (!record) {
        throw new ExecutionBudgetStateError(
          `Budget lineage ${lineage.budgetLineageId} is missing revision ${revision}.`,
        );
      }
      if (record.previousContentHash !== previousHash) {
        throw new ExecutionBudgetStateError(
          `Budget lineage ${lineage.budgetLineageId} revision ${revision} does not chain from the prior revision's hash.`,
        );
      }
      const { contentHash, ...rest } = record;
      if (canonicalContentHash(rest) !== contentHash) {
        throw new ExecutionBudgetStateError(
          `Budget lineage ${lineage.budgetLineageId} revision ${revision} content hash does not match its recorded content; refusing to trust tampered evidence.`,
        );
      }
      if (record.writerFence < previousWriterFence) {
        throw new ExecutionBudgetStateError(
          `Budget lineage ${lineage.budgetLineageId} writer fence regressed at revision ${revision}; refusing impossible authoritative history.`,
        );
      }
      if (
        revision > 0 &&
        record.writerFence === previousWriterFence &&
        record.writerLeaseId !== previousWriterLeaseId
      ) {
        throw new ExecutionBudgetStateError(
          `Budget lineage ${lineage.budgetLineageId} changed writer identity without increasing its fence at revision ${revision}.`,
        );
      }
      if (
        revision > 0 &&
        record.writerFence > previousWriterFence &&
        record.writerLeaseId === previousWriterLeaseId
      ) {
        throw new ExecutionBudgetStateError(
          `Budget lineage ${lineage.budgetLineageId} increased its fence without minting a new writer identity at revision ${revision}.`,
        );
      }
      previousHash = contentHash;
      previousWriterFence = record.writerFence;
      previousWriterLeaseId = record.writerLeaseId;
    }
    const latest = byRevision.get(revisions.at(-1) ?? -1);
    if (!latest || JSON.stringify(latest.lineage) !== JSON.stringify(lineage)) {
      throw new ExecutionBudgetStateError(
        `Budget lineage ${lineage.budgetLineageId} recovery metadata does not match its authority grant.`,
      );
    }
    const ledger = new ExecutionBudgetLedger(
      LEDGER_CONSTRUCTOR_TOKEN,
      lineage,
      evidenceStore,
      writerLease,
      options,
    );
    ledger.revision = latest.revision;
    ledger.lastSnapshot = structuredClone(latest);
    ledger.terminalBudgetReason = latest.terminalBudgetReason;
    ledger.violation = latest.violation;
    ledger.reservations = new Map(
      latest.reservations.map((reservation) => [
        reservation.budgetReservationId,
        structuredClone(reservation),
      ]),
    );

    const draft: LedgerDraft = {
      reservations: new Map(ledger.reservations),
      terminalBudgetReason: ledger.terminalBudgetReason,
      violation: ledger.violation,
    };
    let recovered = false;
    for (const reservation of draft.reservations.values()) {
      if (reservation.state === "PENDING") {
        // Fix Section 11 (PENDING recovery proof): recovery may only convert
        // PENDING -> CANCELLED_BEFORE_INVOCATION while THIS process holds
        // authoritative ownership (the lease acquired above), and only
        // because durable history proves invocation never began for this
        // reservation -- PENDING never advanced to a durable INVOKED record.
        reservation.state = "CANCELLED_BEFORE_INVOCATION";
        reservation.settledAt = ledger.now().toISOString();
        reservation.terminalReason = "recovery-proved-invocation-not-started";
        recovered = true;
      } else if (reservation.state === "INVOKED") {
        // Accounting is conservatively closed, but UNRESOLVED is deliberately
        // preserved: full charging does not prove the remote provider stopped.
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
    if (recovered) {
      try {
        await ledger.persistDraftDirectly(draft);
      } catch (error) {
        throw new ExecutionBudgetEvidencePersistenceError(
          `Recovery safety corrections for ${lineage.budgetLineageId} could not be durably recorded; refusing to hand back an unsafe ledger.`,
          error,
        );
      }
    }
    return ledger;
  }

  get budgetLineageId(): string {
    return this.lineage.budgetLineageId;
  }

  get evidenceDurability(): ExecutionBudgetEvidenceDurability {
    return this.evidenceStore.durability;
  }

  /**
   * MUST be called immediately before invoking a provider (see
   * live-adapter-support.ts) and is safe to call at any other time as a
   * pre-flight check. No-ops when the evidence store has no cross-process
   * writer-lease concept (i.e. the in-memory store), since that store cannot
   * be observed outside this one process.
   *
   * Heartbeat reduces accidental expiry but does not prove remote execution
   * stopped, and an invocation may outlive any finite TTL. If takeover later
   * occurs, durable UNRESOLVED state blocks another generation independently
   * of accounting settlement. Heartbeat itself is serialized with takeover,
   * so a superseded fence can never overwrite and resurrect its pointer.
   */
  async assertWriterAuthority(): Promise<void> {
    if (this.poisoned) {
      throw new ExecutionBudgetPoisonedError(
        this.poisonReason ??
          "This execution-budget ledger is poisoned after an uncertain persistence failure.",
      );
    }
    await this.writerLease?.heartbeat();
  }

  snapshot(): ExecutionBudgetLedgerSnapshot {
    if (!this.lastSnapshot) {
      throw new ExecutionBudgetStateError("Execution budget ledger has no durable snapshot yet.");
    }
    return structuredClone(this.lastSnapshot);
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

    type AdmissionOutcome =
      | { kind: "violation-blocked" }
      | { kind: "denied"; reason: ExecutionBudgetStopReason }
      | { kind: "admitted"; reservations: ExecutionBudgetReservation[] };

    const outcome = await this.runMutation<AdmissionOutcome>((draft) => {
      if (draft.violation) {
        return { changed: false, value: { kind: "violation-blocked" } };
      }
      if (
        [...draft.reservations.values()].some(
          (reservation) => reservation.remoteInvocationState === "UNRESOLVED",
        )
      ) {
        throw new ExecutionBudgetUnresolvedRemoteInvocationError();
      }
      const before = this.projectFromDraft(draft);
      const requestedCalls = inputs.length;
      const requestedTokens = sum(inputs.map((input) => input.requestedOutputTokenAllowance));
      if (requestedCalls > before.modelCallsRemaining) {
        const changed = draft.terminalBudgetReason !== "MODEL_CALL_BUDGET_EXHAUSTED";
        draft.terminalBudgetReason = "MODEL_CALL_BUDGET_EXHAUSTED";
        return { changed, value: { kind: "denied", reason: "MODEL_CALL_BUDGET_EXHAUSTED" } };
      }
      if (requestedTokens > before.outputTokensRemaining) {
        const changed = draft.terminalBudgetReason !== "OUTPUT_TOKEN_BUDGET_EXHAUSTED";
        draft.terminalBudgetReason = "OUTPUT_TOKEN_BUDGET_EXHAUSTED";
        return { changed, value: { kind: "denied", reason: "OUTPUT_TOKEN_BUDGET_EXHAUSTED" } };
      }
      for (const input of inputs) {
        if ([...draft.reservations.values()].some((r) => r.providerRunId === input.providerRunId)) {
          // M2 fix: one providerRunId identifies exactly one concrete provider
          // execution/reservation for this lineage's whole lifetime, never a
          // second admission -- this is what lets ProviderRun.turns mean "1".
          throw new ExecutionBudgetStateError(
            `Provider run ${input.providerRunId} has already been admitted; a providerRunId cannot be reused for a second reservation.`,
          );
        }
      }
      const admittedAt = this.now().toISOString();
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
          remoteInvocationState: "NOT_STARTED",
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
        draft.reservations.set(reservation.budgetReservationId, reservation);
      }
      draft.terminalBudgetReason = null;
      return { changed: true, value: { kind: "admitted", reservations } };
    });

    if (outcome.kind === "violation-blocked") {
      throw new ExecutionBudgetAdmissionError(
        "ENFORCEMENT_VIOLATION",
        "Execution budget lineage is blocked by an enforcement violation.",
      );
    }
    if (outcome.kind === "denied") {
      throw new ExecutionBudgetAdmissionError(
        outcome.reason,
        outcome.reason === "MODEL_CALL_BUDGET_EXHAUSTED"
          ? "Model-call budget is exhausted."
          : "Output-token budget is exhausted.",
      );
    }
    return outcome.reservations.map((reservation) => structuredClone(reservation));
  }

  async cancelBeforeInvocation(budgetReservationId: string, reason: string): Promise<void> {
    await this.runMutation((draft) => {
      const reservation = requireReservation(draft, budgetReservationId);
      if (reservation.state === "CANCELLED_BEFORE_INVOCATION")
        return { changed: false, value: undefined };
      if (reservation.state !== "PENDING") {
        throw new ExecutionBudgetStateError(
          `Reservation ${budgetReservationId} cannot prove pre-invocation cancellation from ${reservation.state}.`,
        );
      }
      reservation.state = "CANCELLED_BEFORE_INVOCATION";
      reservation.settledAt = this.now().toISOString();
      reservation.terminalReason = reason;
      return { changed: true, value: undefined };
    });
  }

  async markInvoked(budgetReservationId: string): Promise<void> {
    await this.runMutation((draft) => {
      const reservation = requireReservation(draft, budgetReservationId);
      if (reservation.state === "INVOKED") return { changed: false, value: undefined };
      if (reservation.state !== "PENDING") {
        throw new ExecutionBudgetStateError(
          `Reservation ${budgetReservationId} cannot be invoked from ${reservation.state}.`,
        );
      }
      reservation.state = "INVOKED";
      reservation.remoteInvocationState = "UNRESOLVED";
      reservation.invokedAt = this.now().toISOString();
      return { changed: true, value: undefined };
    });
  }

  /**
   * Records the only terminal proof currently available to the direct HTTP
   * adapters: their exact trusted transport returned a complete response.
   * A timeout, abort, network error, crash, or lease expiry never calls this.
   */
  async markRemoteInvocationTerminal(budgetReservationId: string): Promise<void> {
    await this.runMutation((draft) => {
      const reservation = requireReservation(draft, budgetReservationId);
      if (reservation.remoteInvocationState === "TERMINAL") {
        return { changed: false, value: undefined };
      }
      if (reservation.state !== "INVOKED" || reservation.remoteInvocationState !== "UNRESOLVED") {
        throw new ExecutionBudgetStateError(
          `Reservation ${budgetReservationId} cannot prove remote terminal execution from ${reservation.state}/${reservation.remoteInvocationState}.`,
        );
      }
      reservation.remoteInvocationState = "TERMINAL";
      return { changed: true, value: undefined };
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
    await this.runMutation((draft) => {
      const reservation = requireReservation(draft, budgetReservationId);
      if (reservation.state !== "INVOKED") {
        throw new ExecutionBudgetStateError(
          `Reservation ${budgetReservationId} cannot record streaming usage from ${reservation.state}.`,
        );
      }
      if (observed > reservation.outputTokenAllowance || observed > reservation.providerHardCap) {
        applyViolation(
          draft,
          reservation,
          observed,
          "streaming-output-exceeded-hard-cap",
          this.now,
        );
        return { changed: true, value: undefined };
      }
      if (
        reservation.latestCumulativeOutputTokens !== null &&
        observed < reservation.latestCumulativeOutputTokens
      ) {
        // B5 fix: a smaller cumulative reading can never overwrite a larger
        // one that has already been durably observed inside this same
        // atomic transaction -- settle conservatively (full charge) instead.
        reservation.state = "SETTLED_CONSERVATIVE";
        reservation.observedOutputTokens = null;
        reservation.policyChargedOutputTokens = reservation.outputTokenAllowance;
        reservation.settledAt = this.now().toISOString();
        reservation.terminalReason = "contradictory-streaming-cumulative-usage";
        reservation.settlementFingerprint = fingerprint({
          state: reservation.state,
          reason: reservation.terminalReason,
        });
        return { changed: true, value: undefined };
      }
      if (reservation.latestCumulativeOutputTokens === observed) {
        return { changed: false, value: undefined };
      }
      reservation.latestCumulativeOutputTokens = observed;
      return { changed: true, value: undefined };
    });
  }

  async settleAuthoritative(
    budgetReservationId: string,
    observedOutputTokens: unknown,
  ): Promise<ExecutionBudgetReservationState> {
    return this.runMutation((draft) => {
      const reservation = requireReservation(draft, budgetReservationId);
      if (reservation.remoteInvocationState !== "TERMINAL") {
        throw new ExecutionBudgetStateError(
          `Reservation ${budgetReservationId} cannot accept authoritative terminal usage while its remote invocation is ${reservation.remoteInvocationState}.`,
        );
      }
      if (!Number.isInteger(observedOutputTokens) || Number(observedOutputTokens) < 0) {
        return settleConservativeOnDraft(
          draft,
          reservation,
          null,
          "invalid-or-unsupported-authoritative-usage",
          this.now,
        );
      }
      const observed = Number(observedOutputTokens);
      if (observed > reservation.outputTokenAllowance || observed > reservation.providerHardCap) {
        return settleViolationOnDraft(
          draft,
          reservation,
          observed,
          "observed-output-exceeded-hard-cap",
          this.now,
        );
      }
      // B5 fix: this comparison and the mutation it drives both happen inside
      // the SAME atomic transaction that reads reservation state, so a
      // concurrent streaming observation can never be missed or overwritten.
      if (
        reservation.latestCumulativeOutputTokens !== null &&
        observed < reservation.latestCumulativeOutputTokens
      ) {
        return settleConservativeOnDraft(
          draft,
          reservation,
          null,
          "terminal-usage-contradicts-streaming-cumulative-usage",
          this.now,
        );
      }
      const settlementFingerprint = fingerprint({ state: "SETTLED_AUTHORITATIVE", observed });
      return transitionTerminalOnDraft(
        draft,
        reservation,
        settlementFingerprint,
        this.now,
        (current) => {
          current.state = "SETTLED_AUTHORITATIVE";
          current.observedOutputTokens = observed;
          current.policyChargedOutputTokens = observed;
          current.settledAt = this.now().toISOString();
          current.terminalReason = "authoritative-terminal-usage";
          current.settlementFingerprint = settlementFingerprint;
        },
      );
    });
  }

  async settleConservative(
    budgetReservationId: string,
    observedOutputTokens: number | null,
    reason: string,
  ): Promise<void> {
    await this.runMutation((draft) => {
      const reservation = requireReservation(draft, budgetReservationId);
      const result = settleConservativeOnDraft(
        draft,
        reservation,
        observedOutputTokens,
        reason,
        this.now,
      );
      return { changed: result.changed, value: undefined };
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
    await this.runMutation((draft) => {
      const reservation = requireReservation(draft, budgetReservationId);
      if (
        reservation.settlementFingerprint === settlementFingerprint &&
        reservation.state === "VIOLATION"
      ) {
        return { changed: false, value: undefined };
      }
      if (reservation.state === "PENDING") {
        throw new ExecutionBudgetStateError(
          `Reservation ${budgetReservationId} cannot record a provider violation before invocation.`,
        );
      }
      applyViolation(draft, reservation, observed, reason, this.now, settlementFingerprint);
      return { changed: true, value: undefined };
    });
  }

  /** Used only by ExecutionBudgetLedger.recover() to commit safety corrections. */
  private async persistDraftDirectly(draft: LedgerDraft): Promise<void> {
    await this.commitDraft(draft);
  }

  private async persistInitialSnapshot(): Promise<void> {
    const draft = this.draftOfLiveState();
    await this.commitDraft(draft);
  }

  private draftOfLiveState(): LedgerDraft {
    return {
      reservations: new Map(
        [...this.reservations].map(([id, reservation]) => [id, structuredClone(reservation)]),
      ),
      terminalBudgetReason: this.terminalBudgetReason,
      violation: this.violation,
    };
  }

  private projectFromDraft(draft: LedgerDraft): {
    modelCallsRemaining: number;
    outputTokensRemaining: number;
  } {
    const reservations = [...draft.reservations.values()];
    const pending = reservations.filter((reservation) => reservation.state === "PENDING");
    const invoked = reservations.filter((reservation) => reservation.state === "INVOKED");
    const initiated = reservations.filter(
      (reservation) =>
        reservation.state !== "PENDING" && reservation.state !== "CANCELLED_BEFORE_INVOCATION",
    );
    const policyChargedOutputTokens = sum(
      initiated.map((reservation) => reservation.policyChargedOutputTokens),
    );
    const outputTokensReserved = sum(
      [...pending, ...invoked].map((reservation) => reservation.outputTokenAllowance),
    );
    return {
      modelCallsRemaining: Math.max(
        0,
        this.lineage.maxModelCalls - initiated.length - pending.length,
      ),
      outputTokensRemaining: Math.max(
        0,
        this.lineage.maxOutputTokens - policyChargedOutputTokens - outputTokensReserved,
      ),
    };
  }

  /**
   * B4 fix: the single transactional entry point every mutating operation
   * goes through. `mutate` reads and modifies a throwaway copy of live state
   * (`draft`); nothing is written back to the live ledger fields until the
   * candidate snapshot has been durably persisted. If persistence fails for
   * ANY reason -- the append, the fsync, or the close -- Beacon cannot know
   * whether bytes reached durable storage, so it does not attempt to "undo"
   * and keep going. It poisons the ledger instead: live state is left exactly
   * as it was before this attempt (still safe), and every future mutating
   * call on this instance fails closed until a fresh, governed `recover()`
   * re-establishes durable truth.
   */
  private async runMutation<T>(mutate: (draft: LedgerDraft) => MutationOutcome<T>): Promise<T> {
    return this.runExclusive(async () => {
      if (this.poisoned) {
        throw new ExecutionBudgetPoisonedError(
          this.poisonReason ??
            "This execution-budget ledger is poisoned after an uncertain persistence failure.",
        );
      }
      const draft = this.draftOfLiveState();
      const { changed, value } = mutate(draft);
      if (!changed) return value;
      await this.commitDraft(draft);
      return value;
    });
  }

  private async commitDraft(draft: LedgerDraft): Promise<void> {
    // Re-validate ownership immediately before the durable write, closing the
    // window where a takeover happened between this transaction starting and
    // reaching its persistence step. Using heartbeat() (not just
    // assertOwnership()) also refreshes the lease's TTL on every mutation, so
    // a lineage under regular activity (admission, streaming observation,
    // settlement) never goes stale merely from wall-clock time passing.
    await this.writerLease?.heartbeat();
    const revision = this.revision + 1;
    const recordedAt = this.now().toISOString();
    const snapshot = this.buildSnapshotFrom(
      draft,
      revision,
      recordedAt,
      this.lastSnapshot?.contentHash ?? null,
    );
    try {
      await this.evidenceStore.append(snapshot);
    } catch (error) {
      this.poisoned = true;
      this.poisonReason =
        error instanceof Error
          ? `Durable persistence failed and could not be verified: ${error.message}`
          : "Durable persistence failed and could not be verified.";
      throw error;
    }
    this.reservations = draft.reservations;
    this.terminalBudgetReason = draft.terminalBudgetReason;
    this.violation = draft.violation;
    this.revision = revision;
    this.lastSnapshot = snapshot;
  }

  private runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.mutationQueue.then(operation, operation);
    this.mutationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private buildSnapshotFrom(
    draft: LedgerDraft,
    revision: number,
    recordedAt: string,
    previousContentHash: string | null,
  ): ExecutionBudgetLedgerSnapshot {
    const reservations = [...draft.reservations.values()].map((reservation) =>
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
    const withoutHash = {
      schemaVersion: 1 as const,
      revision,
      recordedAt,
      lineage: this.lineage,
      writerLeaseId: this.writerLease?.writerLeaseId ?? "process-local-in-memory-writer",
      writerFence: this.writerLease?.fence ?? 1,
      previousContentHash,
      modelCallsReserved: pending.length,
      modelCallsInitiated: initiated.length,
      outputTokensReserved,
      observedOutputTokens: observed.some((value) => value === null)
        ? null
        : sum(observed as number[]),
      policyChargedOutputTokens,
      modelCallsRemaining,
      outputTokensRemaining,
      terminalBudgetReason: draft.terminalBudgetReason,
      violation: draft.violation,
      reservations,
    };
    const contentHash = canonicalContentHash(withoutHash);
    return ExecutionBudgetLedgerSnapshotSchema.parse({ ...withoutHash, contentHash });
  }
}

function requireReservation(
  draft: LedgerDraft,
  budgetReservationId: string,
): ExecutionBudgetReservation {
  const reservation = draft.reservations.get(budgetReservationId);
  if (!reservation) {
    throw new ExecutionBudgetStateError(`Unknown budget reservation ${budgetReservationId}.`);
  }
  return reservation;
}

function applyViolation(
  draft: LedgerDraft,
  reservation: ExecutionBudgetReservation,
  observedOutputTokens: number | null,
  reason: string,
  now: () => Date,
  settlementFingerprint = fingerprint({
    state: "VIOLATION",
    observed: observedOutputTokens,
    reason,
  }),
): void {
  reservation.state = "VIOLATION";
  reservation.observedOutputTokens = observedOutputTokens;
  reservation.policyChargedOutputTokens = reservation.outputTokenAllowance;
  reservation.settledAt = now().toISOString();
  reservation.terminalReason = reason;
  reservation.settlementFingerprint = settlementFingerprint;
  draft.terminalBudgetReason = "ENFORCEMENT_VIOLATION";
  draft.violation = {
    budgetReservationId: reservation.budgetReservationId,
    reason,
    observedOutputTokens,
    recordedAt: now().toISOString(),
  };
}

function settleConservativeOnDraft(
  draft: LedgerDraft,
  reservation: ExecutionBudgetReservation,
  observedOutputTokens: number | null,
  reason: string,
  now: () => Date,
): MutationOutcome<ExecutionBudgetReservationState> {
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
    return settleViolationOnDraft(draft, reservation, observed, reason, now);
  }
  const settlementFingerprint = fingerprint({ state: "SETTLED_CONSERVATIVE", observed, reason });
  return transitionTerminalOnDraft(draft, reservation, settlementFingerprint, now, (current) => {
    current.state = "SETTLED_CONSERVATIVE";
    current.observedOutputTokens = observed;
    current.policyChargedOutputTokens = current.outputTokenAllowance;
    current.settledAt = now().toISOString();
    current.terminalReason = reason;
    current.settlementFingerprint = settlementFingerprint;
  });
}

function settleViolationOnDraft(
  draft: LedgerDraft,
  reservation: ExecutionBudgetReservation,
  observedOutputTokens: number | null,
  reason: string,
  now: () => Date,
): MutationOutcome<ExecutionBudgetReservationState> {
  applyViolation(draft, reservation, observedOutputTokens, reason, now);
  return { changed: true, value: "VIOLATION" };
}

function transitionTerminalOnDraft(
  draft: LedgerDraft,
  reservation: ExecutionBudgetReservation,
  settlementFingerprint: string,
  now: () => Date,
  mutate: (reservation: ExecutionBudgetReservation) => void,
): MutationOutcome<ExecutionBudgetReservationState> {
  if (isTerminal(reservation.state)) {
    if (reservation.settlementFingerprint === settlementFingerprint) {
      return { changed: false, value: reservation.state };
    }
    reservation.state = "VIOLATION";
    reservation.policyChargedOutputTokens = Math.max(
      reservation.policyChargedOutputTokens,
      reservation.outputTokenAllowance,
    );
    reservation.settledAt = now().toISOString();
    reservation.terminalReason = "contradictory-duplicate-settlement";
    reservation.settlementFingerprint = fingerprint({
      previous: reservation.settlementFingerprint,
      contradictory: settlementFingerprint,
    });
    draft.terminalBudgetReason = "ENFORCEMENT_VIOLATION";
    draft.violation = {
      budgetReservationId: reservation.budgetReservationId,
      reason: "contradictory-duplicate-settlement",
      observedOutputTokens: reservation.observedOutputTokens,
      recordedAt: now().toISOString(),
    };
    return { changed: true, value: "VIOLATION" };
  }
  if (reservation.state !== "INVOKED") {
    throw new ExecutionBudgetStateError(
      `Reservation ${reservation.budgetReservationId} cannot settle from ${reservation.state}.`,
    );
  }
  mutate(reservation);
  return { changed: true, value: reservation.state };
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
