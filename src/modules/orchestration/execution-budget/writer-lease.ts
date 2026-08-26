import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
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

const DEFAULT_TTL_MS = 60_000;
const MAX_ACQUIRE_ATTEMPTS = 8;

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

  private constructor(
    dir: string,
    writerLeaseId: string,
    fence: number,
    ttlMs: number,
    now: () => Date,
  ) {
    this.dir = dir;
    this.writerLeaseId = writerLeaseId;
    this.fence = fence;
    this.ttlMs = ttlMs;
    this.now = now;
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
  }): Promise<ExecutionBudgetWriterLease> {
    const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    const now = options.now ?? (() => new Date());
    await mkdir(options.dir, { recursive: true, mode: 0o700 });

    for (let attempt = 0; attempt < MAX_ACQUIRE_ATTEMPTS; attempt += 1) {
      const existing = await readPointer(this.pointerPathFor(options.dir));
      if (existing && !isExpired(existing, now().getTime())) {
        throw new ExecutionBudgetWriterLeaseUnavailableError(
          "An active writer already holds this execution-budget lineage's writer lease. " +
            "Refusing to mint a second concurrent writer; availability loss is acceptable, " +
            "double provider execution is not.",
        );
      }
      const nextFence = existing ? existing.fence + 1 : 1;
      const fenceDir = join(options.dir, `fence-${nextFence}`);
      try {
        await mkdir(fenceDir, { mode: 0o700 });
      } catch (error) {
        if (hasCode(error, "EEXIST")) continue; // lost this fence slot; re-read and retry
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
      return new ExecutionBudgetWriterLease(options.dir, writerLeaseId, nextFence, ttlMs, now);
    }
    throw new ExecutionBudgetWriterLeaseUnavailableError(
      "Could not acquire the writer-lease fence after repeated contention. Failing closed; " +
        "this requires explicit governed recovery, not automatic retry.",
    );
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

  /** Extends the TTL window so a live, working writer is never mistaken for stale. */
  async heartbeat(): Promise<void> {
    await this.assertOwnership();
    const pointer: WriterLeasePointer = {
      schemaVersion: 1,
      writerLeaseId: this.writerLeaseId,
      fence: this.fence,
      hostId: hostname(),
      pid: process.pid,
      acquiredAt: (await readPointer(this.pointerPath))?.acquiredAt ?? this.now().toISOString(),
      heartbeatAt: this.now().toISOString(),
      ttlMs: this.ttlMs,
    };
    await writePointerAtomically(this.dir, this.pointerPath, pointer);
  }

  /**
   * Administrative-only, bounded escape hatch for the failure mode where a
   * writer crashed between claiming a fence slot and recording its pointer,
   * permanently blocking automatic takeover. This performs no liveness check
   * of its own -- calling it safely is a human governance decision, never an
   * automatic one, and no code path in this repository invokes it.
   */
  static async dangerouslyResetForGovernedRecovery(dir: string): Promise<void> {
    await rm(dir, { recursive: true, force: true });
  }
}
