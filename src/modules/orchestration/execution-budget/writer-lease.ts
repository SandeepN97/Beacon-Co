import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, rmdir, writeFile } from "node:fs/promises";
import { hostname } from "node:os";
import { join } from "node:path";
import { z } from "astro/zod";

/**
 * Cross-process exclusive-writer/fencing primitive for one ExecutionBudgetLedger
 * lineage (Phase 1.5 correction B1/B4/B5 -- independent security review on PR #83,
 * candidate e895f60e72f912221b7bf9d001d8aa49bdd993eb).
 *
 * `mutationQueue` alone only serializes calls inside ONE JavaScript object in ONE
 * process. It does nothing to stop a second OS process (a retried CLI invocation,
 * an orphaned worker, a second scheduler tick) from independently constructing a
 * ledger for the same budgetLineageId and invoking a provider concurrently. This
 * module is the bounded, filesystem-only exclusive-writer mechanism required
 * instead: no database, queue, or lock daemon, only atomic POSIX primitives
 * (`mkdir` fails EEXIST atomically; `rename` replaces atomically on the same
 * filesystem).
 *
 * Design: a monotonically increasing "fence" is represented as a claimed
 * subdirectory (`fence-<N>`). Claiming `fence-<N>` uses `mkdir`, which the
 * filesystem guarantees only one caller can win for a given path. The winner
 * then durably records itself as current owner via write-temp-then-rename
 * (atomic replace) into `current.json`. Every later authoritative mutation --
 * and, most importantly, the instant before a provider is actually invoked --
 * must re-read `current.json` and prove its own `writerLeaseId`/`fence` are
 * still the ones on record. A process that becomes stale (suspended, GC-paused,
 * partitioned) is not stopped from *believing* it still owns the lease, but it
 * is stopped from *acting* on that belief, because the fence recheck immediately
 * before the irreversible step (provider invocation, ledger mutation) will fail
 * once a takeover has replaced `current.json`. This is the standard fencing-token
 * pattern: correctness comes from the final recheck, not from the improbability
 * of two processes racing.
 *
 * Heartbeat/TTL expiry is used only to decide whether a *takeover* may be
 * attempted, never to grant a process continued authority. A takeover always
 * mints a brand-new `writerLeaseId` and a strictly greater `fence`; it never
 * extends or resurrects the previous owner's identity. If the filesystem cannot
 * prove exclusivity (a claimed fence directory left behind by a process that
 * crashed between claiming it and writing the pointer), acquisition fails closed
 * after bounded retries rather than guessing -- per Section 5 of the corrective
 * mission, availability loss is acceptable here; a second live writer is not.
 * `dangerouslyResetForGovernedRecovery` exists for that bounded failure mode and
 * must only ever be invoked by an explicit, human-initiated recovery operation.
 */

// A long default reduces accidental takeovers, but it is never treated as
// proof that a remote request terminated. Round 3 preserves unresolved remote
// invocation state across any eventual takeover and blocks re-execution.
const DEFAULT_TTL_MS = 600_000;
const MAX_ACQUIRE_ATTEMPTS = 8;
const AUTHORITY_OPERATION_LOCK = "authority-operation.lock";
const MAX_OPERATION_LOCK_ATTEMPTS = 100;

const WriterLeasePointerSchema = z
  .object({
    schemaVersion: z.literal(1),
    writerLeaseId: z.string().min(1).max(200),
    fence: z.number().int().positive(),
    hostId: z.string().min(1).max(200),
    pid: z.number().int().positive(),
    acquiredAt: z.string().min(1),
    heartbeatAt: z.string().min(1),
    ttlMs: z.number().int().positive(),
  })
  .strict();
export type WriterLeasePointer = z.infer<typeof WriterLeasePointerSchema>;

export interface ExecutionBudgetWriterLeaseTestHooks {
  /** Deterministic race barrier used only by adversarial tests. */
  beforeHeartbeatPointerWrite?(): Promise<void>;
}

export class ExecutionBudgetWriterFenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecutionBudgetWriterFenceError";
  }
}

export class ExecutionBudgetWriterLeaseUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecutionBudgetWriterLeaseUnavailableError";
  }
}

function hasCode(error: unknown, code: string): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

/**
 * Read-only accessor for the current writer-lease pointer of a lineage's
 * `writer` directory. Used by `AppendOnlyNdjsonExecutionBudgetEvidenceStore`
 * so the STORE itself -- not only `ExecutionBudgetLedger` -- refuses to
 * durably record a snapshot whose `writerLeaseId`/`writerFence` do not match
 * the currently active lease, closing the path where code with a store
 * instance (but no real lease) fabricates and appends journal history
 * directly (independent rereview of PR #83, candidate
 * 225384030a4a30d66c946bdbc0d577a057a8a0c6).
 */
export async function readCurrentWriterPointer(
  writerDir: string,
): Promise<WriterLeasePointer | null> {
  return readPointer(join(writerDir, "current.json"));
}

async function readPointer(pointerPath: string): Promise<WriterLeasePointer | null> {
  let raw: string;
  try {
    raw = await readFile(pointerPath, "utf8");
  } catch (error) {
    if (hasCode(error, "ENOENT")) return null;
    throw new ExecutionBudgetWriterLeaseUnavailableError(
      `Unable to read writer-lease pointer at ${pointerPath}.`,
    );
  }
  try {
    return WriterLeasePointerSchema.parse(JSON.parse(raw));
  } catch {
    throw new ExecutionBudgetWriterLeaseUnavailableError(
      `Writer-lease pointer at ${pointerPath} is malformed or tampered; refusing to trust it.`,
    );
  }
}

async function writePointerAtomically(
  dir: string,
  pointerPath: string,
  pointer: WriterLeasePointer,
): Promise<void> {
  const tmpPath = join(dir, `.current.${randomUUID()}.tmp`);
  await writeFile(tmpPath, JSON.stringify(pointer), { encoding: "utf8", mode: 0o600 });
  await rename(tmpPath, pointerPath);
}

/**
 * Serializes every read/modify/write of writer authority with every evidence
 * append for this lineage. `rename()` makes one replacement atomic, but it is
 * not compare-and-swap; this mkdir lock supplies the missing filesystem-safe
 * critical section. A crashed holder intentionally leaves the directory in
 * place and blocks automatic progress until governed recovery.
 */
export async function withWriterAuthorityLock<T>(
  writerDir: string,
  operation: () => Promise<T>,
): Promise<T> {
  await mkdir(writerDir, { recursive: true, mode: 0o700 });
  const lockDir = join(writerDir, AUTHORITY_OPERATION_LOCK);
  let acquired = false;
  for (let attempt = 0; attempt < MAX_OPERATION_LOCK_ATTEMPTS; attempt += 1) {
    try {
      await mkdir(lockDir, { mode: 0o700 });
      acquired = true;
      break;
    } catch (error) {
      if (!hasCode(error, "EEXIST")) {
        throw new ExecutionBudgetWriterLeaseUnavailableError(
          "Unable to acquire the execution-budget writer authority lock.",
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
  }
  if (!acquired) {
    throw new ExecutionBudgetWriterLeaseUnavailableError(
      "The execution-budget writer authority lock is unavailable. Failing closed; " +
        "a possibly crashed holder requires explicit governed recovery.",
    );
  }
  let result!: T;
  let operationError: unknown;
  try {
    result = await operation();
  } catch (error) {
    operationError = error;
  }
  let releaseError: unknown;
  try {
    await rmdir(lockDir);
  } catch (error) {
    releaseError = error;
  }
  if (operationError) throw operationError;
  if (releaseError) {
    throw new ExecutionBudgetWriterLeaseUnavailableError(
      `Unable to release the execution-budget writer authority lock: ${releaseError instanceof Error ? releaseError.message : "unknown filesystem failure"}`,
    );
  }
  return result;
}

async function highestClaimedFence(dir: string): Promise<number> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch (error) {
    if (hasCode(error, "ENOENT")) return 0;
    throw new ExecutionBudgetWriterLeaseUnavailableError(
      "Unable to inspect claimed execution-budget writer fences.",
    );
  }
  return entries.reduce((highest, entry) => {
    const match = /^fence-(\d+)$/.exec(entry);
    if (!match) return highest;
    const fence = Number(match[1]);
    return Number.isSafeInteger(fence) && fence > highest ? fence : highest;
  }, 0);
}

function isExpired(pointer: WriterLeasePointer, nowMs: number): boolean {
  const heartbeatMs = Date.parse(pointer.heartbeatAt);
  if (Number.isNaN(heartbeatMs)) return true;
  return nowMs - heartbeatMs > pointer.ttlMs;
}

export class ExecutionBudgetWriterLease {
  private readonly dir: string;
  readonly writerLeaseId: string;
  readonly fence: number;
  private readonly ttlMs: number;
  private readonly now: () => Date;
  private readonly testHooks: ExecutionBudgetWriterLeaseTestHooks;

  private constructor(
    dir: string,
    writerLeaseId: string,
    fence: number,
    ttlMs: number,
    now: () => Date,
    testHooks: ExecutionBudgetWriterLeaseTestHooks,
  ) {
    this.dir = dir;
    this.writerLeaseId = writerLeaseId;
    this.fence = fence;
    this.ttlMs = ttlMs;
    this.now = now;
    this.testHooks = testHooks;
  }

  private get pointerPath(): string {
    return join(this.dir, "current.json");
  }

  /**
   * Acquire (fresh grant) or take over (expired grant) exclusive writer
   * ownership of the lineage-local `dir`. Used identically by both
   * `ExecutionBudgetLedger.create` and `.recover` so create-vs-recover can
   * never itself become an unprotected race: whichever call reaches this
   * function first wins the fence, and the other fails closed.
   */
  static async acquire(options: {
    dir: string;
    ttlMs?: number;
    now?: () => Date;
    testHooks?: ExecutionBudgetWriterLeaseTestHooks;
  }): Promise<ExecutionBudgetWriterLease> {
    const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    const now = options.now ?? (() => new Date());
    await mkdir(options.dir, { recursive: true, mode: 0o700 });
    return withWriterAuthorityLock(options.dir, async () => {
      const existing = await readPointer(this.pointerPathFor(options.dir));
      if (existing && !isExpired(existing, now().getTime())) {
        throw new ExecutionBudgetWriterLeaseUnavailableError(
          "An active writer already holds this execution-budget lineage's writer lease. " +
            "Refusing to mint a second concurrent writer; availability loss is acceptable, " +
            "double provider execution is not.",
        );
      }
      const claimedFence = await highestClaimedFence(options.dir);
      for (let attempt = 0; attempt < MAX_ACQUIRE_ATTEMPTS; attempt += 1) {
        const nextFence = Math.max(existing?.fence ?? 0, claimedFence) + attempt + 1;
        const fenceDir = join(options.dir, `fence-${nextFence}`);
        try {
          await mkdir(fenceDir, { mode: 0o700 });
        } catch (error) {
          if (hasCode(error, "EEXIST")) continue;
          throw new ExecutionBudgetWriterLeaseUnavailableError(
            "Unable to claim a writer-lease fence slot atomically.",
          );
        }
        const writerLeaseId = `writer-lease-${randomUUID()}`;
        const pointer: WriterLeasePointer = {
          schemaVersion: 1,
          writerLeaseId,
          fence: nextFence,
          hostId: hostname(),
          pid: process.pid,
          acquiredAt: now().toISOString(),
          heartbeatAt: now().toISOString(),
          ttlMs,
        };
        await writePointerAtomically(options.dir, this.pointerPathFor(options.dir), pointer);
        const confirmed = await readPointer(this.pointerPathFor(options.dir));
        if (
          !confirmed ||
          confirmed.writerLeaseId !== writerLeaseId ||
          confirmed.fence !== nextFence
        ) {
          throw new ExecutionBudgetWriterLeaseUnavailableError(
            "Writer-lease acquisition could not be confirmed from durable storage.",
          );
        }
        return new ExecutionBudgetWriterLease(
          options.dir,
          writerLeaseId,
          nextFence,
          ttlMs,
          now,
          options.testHooks ?? {},
        );
      }
      throw new ExecutionBudgetWriterLeaseUnavailableError(
        "Could not acquire a fresh monotonic writer-lease fence. Failing closed; " +
          "this requires explicit governed recovery, not automatic retry.",
      );
    });
  }

  private static pointerPathFor(dir: string): string {
    return join(dir, "current.json");
  }

  /**
   * MUST be called immediately before every authoritative ledger mutation is
   * persisted, and immediately before a provider is invoked. Throws
   * `ExecutionBudgetWriterFenceError` the instant this lease is no longer the
   * lineage's current writer -- including the "Process A wakes up after
   * Process B legitimately took over" scenario, since B's takeover always
   * replaces `current.json` with a new writerLeaseId/fence that A's identity
   * no longer matches.
   */
  async assertOwnership(): Promise<void> {
    const current = await readPointer(this.pointerPath);
    if (!current || current.writerLeaseId !== this.writerLeaseId || current.fence !== this.fence) {
      throw new ExecutionBudgetWriterFenceError(
        "This process's execution-budget writer lease is no longer current; another writer " +
          "now holds the fence. Refusing to mutate ledger state or invoke a provider.",
      );
    }
  }

  /** Atomically refreshes this writer without allowing a stale fence to be restored. */
  async heartbeat(): Promise<void> {
    await withWriterAuthorityLock(this.dir, async () => {
      const current = await readPointer(this.pointerPath);
      if (
        !current ||
        current.writerLeaseId !== this.writerLeaseId ||
        current.fence !== this.fence
      ) {
        throw new ExecutionBudgetWriterFenceError(
          "This process's execution-budget writer lease is no longer current; refusing to refresh stale authority.",
        );
      }
      const pointer: WriterLeasePointer = {
        schemaVersion: 1,
        writerLeaseId: this.writerLeaseId,
        fence: this.fence,
        hostId: hostname(),
        pid: process.pid,
        acquiredAt: current.acquiredAt,
        heartbeatAt: this.now().toISOString(),
        ttlMs: this.ttlMs,
      };
      await this.testHooks.beforeHeartbeatPointerWrite?.();
      await writePointerAtomically(this.dir, this.pointerPath, pointer);
    });
  }

  /**
   * Administrative-only, bounded escape hatch for the failure mode where a
   * writer crashed between claiming a fence slot and recording its pointer,
   * permanently blocking automatic takeover. This performs no liveness check
   * of its own -- calling it safely is a human governance decision, never an
   * automatic one, and no code path in this repository invokes it.
   */
  static async dangerouslyResetForGovernedRecovery(dir: string): Promise<void> {
    // Preserve every fence-N directory as a permanent monotonic watermark.
    // Only the potentially abandoned operation lock and current pointer are
    // cleared; the next acquisition scans the retained claims and mints N+1.
    await rm(join(dir, AUTHORITY_OPERATION_LOCK), { recursive: true, force: true });
    await rm(this.pointerPathFor(dir), { force: true });
  }
}
