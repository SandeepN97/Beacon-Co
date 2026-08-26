import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AppendOnlyNdjsonExecutionBudgetEvidenceStore,
  authorizeExecutionBudgetLineage,
  ExecutionBudgetAdmissionError,
  ExecutionBudgetAuthorityGrant,
  ExecutionBudgetEvidencePersistenceError,
  ExecutionBudgetLedger,
  ExecutionBudgetPoisonedError,
  ExecutionBudgetStateError,
  ExecutionBudgetWriterFenceError,
  ExecutionBudgetWriterLeaseUnavailableError,
  hashLineagePath,
  InMemoryExecutionBudgetEvidenceStore,
  resolveProviderModelCallLimit,
  type ExecutionBudgetEvidenceStore,
  type ExecutionBudgetLineage,
  type ExecutionBudgetLedgerSnapshot,
  type ModelCallAdmission,
} from "../../src/modules/orchestration/execution-budget/execution-budget.ts";

function clock() {
  let tick = 0;
  return () => new Date(Date.UTC(2026, 7, 24, 12, 0, 0, tick++));
}

function idFactory(prefix = "reservation") {
  let sequence = 0;
  return () => `${prefix}-${++sequence}`;
}

/**
 * Every test authorizes against ADR-0023 itself -- a real, committed,
 * `status: "approved"` decision record in this repository -- through the same
 * canonical Decision OS authority boundary and repository-local ADR resolver
 * production code uses (B2 fix). Tests cannot mint authority from bare
 * strings any more than production code can.
 */
interface LineageTestOverrides {
  budgetLineageId?: string;
  workUnitId?: string;
  maxModelCalls?: number;
  maxOutputTokens?: number;
  allocationKind?: "top-level" | "parent-carve-out" | "higher-policy-grant";
  parentBudgetLineageId?: string | null;
}

async function grant(overrides: LineageTestOverrides = {}): Promise<ExecutionBudgetAuthorityGrant> {
  return ExecutionBudgetAuthorityGrant.issue({
    adrRef: {
      schemaVersion: 1,
      adrId: "0023-define-provider-neutral-execution-budget-semantics",
      status: "accepted",
      decisionCandidateRef: "decision-candidate-execution-budget-test",
    },
    workUnitId: overrides.workUnitId ?? "work-unit-test",
    maxModelCalls: overrides.maxModelCalls ?? 5,
    maxOutputTokens: overrides.maxOutputTokens ?? 4_000,
    policySource: "test-fixture",
    grantedAt: "2026-08-24T12:00:00.000Z",
  });
}

async function lineage(overrides: LineageTestOverrides = {}): Promise<ExecutionBudgetLineage> {
  return authorizeExecutionBudgetLineage({
    budgetLineageId: overrides.budgetLineageId ?? "budget-lineage-test",
    grant: await grant(overrides),
    allocationKind: overrides.allocationKind,
    parentBudgetLineageId: overrides.parentBudgetLineageId,
  });
}

async function ledger(
  overrides: Partial<{ workUnitId: string; maxModelCalls: number; maxOutputTokens: number }> = {},
  store = new InMemoryExecutionBudgetEvidenceStore(),
) {
  const authority = await lineage(overrides);
  return {
    authority,
    store,
    ledger: await ExecutionBudgetLedger.create(authority, store, {
      now: clock(),
      reservationId: idFactory(),
    }),
  };
}

function admission(overrides: Partial<ModelCallAdmission> = {}): ModelCallAdmission {
  return {
    providerRunId: "provider-run-1",
    agentRunId: "agent-run-1",
    provider: "claude",
    resolvedModelId: "claude-test",
    kind: "initial",
    requestedOutputTokenAllowance: 100,
    providerHardCap: 100,
    enforcementOwner: "test-direct-http",
    ...overrides,
  };
}

async function invokeAndSettle(
  budget: ExecutionBudgetLedger,
  input: Partial<ModelCallAdmission>,
  outputTokens: number,
) {
  const reservation = await budget.admitModelCall(admission(input));
  await budget.markInvoked(reservation.budgetReservationId);
  await budget.settleAuthoritative(reservation.budgetReservationId, outputTokens);
  return reservation;
}

describe("execution budget authority and terminology", () => {
  it("validates positive ceilings and immutable lineage identity", async () => {
    await expect(lineage({ maxModelCalls: 0 })).rejects.toThrow();
    await expect(lineage({ maxOutputTokens: 1.5 })).rejects.toThrow();
    const { authority } = await ledger();
    expect(Object.isFrozen(authority)).toBe(true);
    expect(authority).toMatchObject({
      budgetLineageId: "budget-lineage-test",
      maxModelCalls: 5,
      maxOutputTokens: 4_000,
    });
  });

  it("maps legacy maxTurns exactly to canonical maxModelCalls", () => {
    expect(resolveProviderModelCallLimit({ maxModelCalls: 3 })).toBe(3);
    expect(resolveProviderModelCallLimit({ legacyMaxTurns: 3 })).toBe(3);
    expect(resolveProviderModelCallLimit({ maxModelCalls: 3, legacyMaxTurns: 3 })).toBe(3);
    expect(() => resolveProviderModelCallLimit({ maxModelCalls: 3, legacyMaxTurns: 4 })).toThrow(
      "must map exactly",
    );
  });

  it("cannot remint durable capacity for an existing lineage", async () => {
    const store = new InMemoryExecutionBudgetEvidenceStore();
    const authority = await lineage();
    await ExecutionBudgetLedger.create(authority, store);
    await expect(ExecutionBudgetLedger.create(authority, store)).rejects.toBeInstanceOf(
      ExecutionBudgetStateError,
    );
  });

  it("requires parent provenance and refuses an unimplemented parent carve-out", async () => {
    await expect(
      lineage({ allocationKind: "parent-carve-out", parentBudgetLineageId: null }),
    ).rejects.toThrow("requires parent budget provenance");
    await expect(
      ExecutionBudgetLedger.create(
        await lineage({
          allocationKind: "parent-carve-out",
          parentBudgetLineageId: "parent-lineage",
        }),
        new InMemoryExecutionBudgetEvidenceStore(),
      ),
    ).rejects.toThrow("requires a future parent-ledger reservation mechanism");
    const higherPolicyGrantLineage = await lineage({
      allocationKind: "higher-policy-grant",
      parentBudgetLineageId: "parent-lineage",
    });
    expect(higherPolicyGrantLineage.parentBudgetLineageId).toBe("parent-lineage");
    await expect(
      ExecutionBudgetLedger.create(
        higherPolicyGrantLineage,
        new InMemoryExecutionBudgetEvidenceStore(),
      ),
    ).rejects.toThrow("no proven capacity-minting mechanism");
  });

  it("rejects authorization built from an unaccepted or fabricated ADR reference", async () => {
    await expect(
      ExecutionBudgetAuthorityGrant.issue({
        adrRef: {
          schemaVersion: 1,
          adrId: "0023-define-provider-neutral-execution-budget-semantics",
          status: "requested",
          decisionCandidateRef: "decision-candidate-execution-budget-test",
        },
        workUnitId: "work-unit-test",
        maxModelCalls: 1,
        maxOutputTokens: 100,
        policySource: "test-fixture",
        grantedAt: "2026-08-24T12:00:00.000Z",
      }),
    ).rejects.toThrow();
    await expect(
      ExecutionBudgetAuthorityGrant.issue({
        adrRef: {
          schemaVersion: 1,
          adrId: "0099-an-adr-that-does-not-exist",
          status: "accepted",
          decisionCandidateRef: "decision-candidate-execution-budget-test",
        },
        workUnitId: "work-unit-test",
        maxModelCalls: 1,
        maxOutputTokens: 100,
        policySource: "test-fixture",
        grantedAt: "2026-08-24T12:00:00.000Z",
      }),
    ).rejects.toThrow("does not correspond to a real, committed decision record");
    await expect(
      ExecutionBudgetAuthorityGrant.issue({
        adrRef: { note: "looks confident, isn't real" },
        workUnitId: "work-unit-test",
        maxModelCalls: 1,
        maxOutputTokens: 100,
        policySource: "test-fixture",
        grantedAt: "2026-08-24T12:00:00.000Z",
      }),
    ).rejects.toThrow();
  });
});

describe("atomic admission and concurrency", () => {
  it("commits neither reservation when durable admission evidence cannot be written", async () => {
    const snapshots: ExecutionBudgetLedgerSnapshot[] = [];
    let appendCount = 0;
    const store: ExecutionBudgetEvidenceStore = {
      durability: "fsync-journal",
      async append(snapshot) {
        appendCount += 1;
        if (appendCount > 1) {
          throw new ExecutionBudgetEvidencePersistenceError(
            "Synthetic journal failure.",
            new Error("disk unavailable"),
          );
        }
        snapshots.push(structuredClone(snapshot));
      },
      async load(budgetLineageId) {
        return snapshots.filter((snapshot) => snapshot.lineage.budgetLineageId === budgetLineageId);
      },
    };
    const budget = await ExecutionBudgetLedger.create(await lineage(), store, {
      now: clock(),
      reservationId: idFactory(),
    });
    await expect(budget.admitModelCall(admission())).rejects.toBeInstanceOf(
      ExecutionBudgetEvidencePersistenceError,
    );
    expect(budget.snapshot()).toMatchObject({
      revision: 0,
      modelCallsReserved: 0,
      outputTokensReserved: 0,
      reservations: [],
    });
  });

  it("denies model call N+1 before invocation across newly constructed requests", async () => {
    const { ledger: budget } = await ledger({ maxModelCalls: 2, maxOutputTokens: 200 });
    await invokeAndSettle(budget, { providerRunId: "request-a" }, 10);
    await invokeAndSettle(budget, { providerRunId: "request-b" }, 10);
    await expect(
      budget.admitModelCall(admission({ providerRunId: "request-c" })),
    ).rejects.toMatchObject({ reason: "MODEL_CALL_BUDGET_EXHAUSTED" });
    expect(budget.snapshot()).toMatchObject({
      modelCallsInitiated: 2,
      modelCallsReserved: 0,
      modelCallsRemaining: 0,
      terminalBudgetReason: "MODEL_CALL_BUDGET_EXHAUSTED",
    });
  });

  it("allows only one of two simultaneous admissions when one call remains", async () => {
    const { ledger: budget } = await ledger({ maxModelCalls: 1, maxOutputTokens: 100 });
    const results = await Promise.allSettled([
      budget.admitModelCall(
        admission({
          providerRunId: "concurrent-a",
          requestedOutputTokenAllowance: 10,
          providerHardCap: 10,
        }),
      ),
      budget.admitModelCall(
        admission({
          providerRunId: "concurrent-b",
          requestedOutputTokenAllowance: 10,
          providerHardCap: 10,
        }),
      ),
    ]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(results.filter(({ status }) => status === "rejected")).toHaveLength(1);
    expect(budget.snapshot().modelCallsReserved).toBe(1);
  });

  it("does not oversubscribe simultaneous output-token reservations", async () => {
    const { ledger: budget } = await ledger({ maxModelCalls: 2, maxOutputTokens: 1_000 });
    const results = await Promise.allSettled([
      budget.admitModelCall(
        admission({
          providerRunId: "tokens-a",
          requestedOutputTokenAllowance: 800,
          providerHardCap: 800,
        }),
      ),
      budget.admitModelCall(
        admission({
          providerRunId: "tokens-b",
          requestedOutputTokenAllowance: 800,
          providerHardCap: 800,
        }),
      ),
    ]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(results.filter(({ status }) => status === "rejected")).toHaveLength(1);
    expect(budget.snapshot().outputTokensReserved).toBe(800);
  });

  it("admits all exposed fan-out branches or none", async () => {
    const { ledger: budget } = await ledger({ maxModelCalls: 4, maxOutputTokens: 400 });
    const kinds = ["batch", "hedge", "fan-out", "fan-out"] as const;
    const reservations = await budget.admitGenerationBranches(
      kinds.map((kind, branchIndex) =>
        admission({
          providerRunId: "fan-out-run",
          kind,
          branchIndex,
          requestedOutputTokenAllowance: 100,
          providerHardCap: 100,
        }),
      ),
    );
    expect(new Set(reservations.map(({ budgetReservationId }) => budgetReservationId)).size).toBe(
      4,
    );
    expect(budget.snapshot()).toMatchObject({
      modelCallsReserved: 4,
      outputTokensReserved: 400,
      modelCallsRemaining: 0,
      outputTokensRemaining: 0,
    });
  });

  it("does not partially reserve a fan-out operation that exceeds either ceiling", async () => {
    const { ledger: budget } = await ledger({ maxModelCalls: 4, maxOutputTokens: 300 });
    await expect(
      budget.admitGenerationBranches(
        [0, 1, 2, 3].map((branchIndex) =>
          admission({
            kind: "fan-out",
            branchIndex,
            requestedOutputTokenAllowance: 100,
            providerHardCap: 100,
          }),
        ),
      ),
    ).rejects.toBeInstanceOf(ExecutionBudgetAdmissionError);
    expect(budget.snapshot()).toMatchObject({
      modelCallsReserved: 0,
      outputTokensReserved: 0,
    });
  });
});

describe("reservation lifecycle and settlement", () => {
  it("releases both reservations only for proven pre-invocation cancellation", async () => {
    const { ledger: budget } = await ledger({ maxModelCalls: 1, maxOutputTokens: 100 });
    const reservation = await budget.admitModelCall(admission());
    await budget.cancelBeforeInvocation(reservation.budgetReservationId, "local-validation-failed");
    expect(budget.snapshot()).toMatchObject({
      modelCallsReserved: 0,
      modelCallsInitiated: 0,
      outputTokensReserved: 0,
      policyChargedOutputTokens: 0,
      modelCallsRemaining: 1,
      outputTokensRemaining: 100,
    });
  });

  it("never releases capacity after uncertain invocation", async () => {
    const { ledger: budget } = await ledger({ maxModelCalls: 1, maxOutputTokens: 2_000 });
    const reservation = await budget.admitModelCall(
      admission({ requestedOutputTokenAllowance: 2_000, providerHardCap: 2_000 }),
    );
    await budget.markInvoked(reservation.budgetReservationId);
    await budget.settleConservative(reservation.budgetReservationId, null, "timeout-or-disconnect");
    expect(budget.snapshot()).toMatchObject({
      modelCallsInitiated: 1,
      observedOutputTokens: null,
      policyChargedOutputTokens: 2_000,
      outputTokensRemaining: 0,
    });
  });

  it("releases unused tokens only after authoritative terminal usage", async () => {
    const { ledger: budget } = await ledger({ maxOutputTokens: 1_000 });
    const reservation = await budget.admitModelCall(
      admission({ requestedOutputTokenAllowance: 800, providerHardCap: 800 }),
    );
    await budget.markInvoked(reservation.budgetReservationId);
    await budget.settleAuthoritative(reservation.budgetReservationId, 250);
    expect(budget.snapshot()).toMatchObject({
      outputTokensReserved: 0,
      observedOutputTokens: 250,
      policyChargedOutputTokens: 250,
      outputTokensRemaining: 750,
    });
  });

  it("settles missing, negative, and fractional usage conservatively", async () => {
    for (const usage of [null, -1, 1.5]) {
      const { ledger: budget } = await ledger({ maxModelCalls: 1, maxOutputTokens: 100 });
      const reservation = await budget.admitModelCall(admission());
      await budget.markInvoked(reservation.budgetReservationId);
      await budget.settleAuthoritative(reservation.budgetReservationId, usage);
      expect(budget.snapshot()).toMatchObject({
        observedOutputTokens: null,
        policyChargedOutputTokens: 100,
      });
      expect(budget.snapshot().reservations[0]?.state).toBe("SETTLED_CONSERVATIVE");
    }
  });

  it("makes an identical duplicate terminal settlement idempotent", async () => {
    const { ledger: budget, store } = await ledger();
    const reservation = await budget.admitModelCall(admission());
    await budget.markInvoked(reservation.budgetReservationId);
    await budget.settleAuthoritative(reservation.budgetReservationId, 25);
    const revision = budget.snapshot().revision;
    const writes = store.snapshots.length;
    await budget.settleAuthoritative(reservation.budgetReservationId, 25);
    expect(budget.snapshot().revision).toBe(revision);
    expect(store.snapshots).toHaveLength(writes);
    expect(budget.snapshot().policyChargedOutputTokens).toBe(25);
  });

  it("records contradictory duplicate settlement as a violation without a second debit", async () => {
    const { ledger: budget } = await ledger({ maxModelCalls: 2, maxOutputTokens: 100 });
    const reservation = await budget.admitModelCall(admission());
    await budget.markInvoked(reservation.budgetReservationId);
    await budget.settleAuthoritative(reservation.budgetReservationId, 25);
    await budget.settleAuthoritative(reservation.budgetReservationId, 30);
    expect(budget.snapshot()).toMatchObject({
      terminalBudgetReason: "ENFORCEMENT_VIOLATION",
      policyChargedOutputTokens: 100,
      violation: { reason: "contradictory-duplicate-settlement" },
    });
    await expect(budget.admitModelCall(admission())).rejects.toMatchObject({
      reason: "ENFORCEMENT_VIOLATION",
    });
  });

  it("records usage above reservation/provider cap as a violation and blocks calls", async () => {
    const { ledger: budget } = await ledger({ maxModelCalls: 2, maxOutputTokens: 200 });
    const reservation = await budget.admitModelCall(admission());
    await budget.markInvoked(reservation.budgetReservationId);
    expect(await budget.settleAuthoritative(reservation.budgetReservationId, 101)).toBe(
      "VIOLATION",
    );
    expect(budget.snapshot()).toMatchObject({
      observedOutputTokens: 101,
      policyChargedOutputTokens: 100,
      terminalBudgetReason: "ENFORCEMENT_VIOLATION",
    });
    await expect(budget.admitModelCall(admission())).rejects.toMatchObject({
      reason: "ENFORCEMENT_VIOLATION",
    });
  });
});

describe("lineage inheritance and projections", () => {
  it("counts every initiated retry and denies retry 3 when maxModelCalls is 3", async () => {
    const { ledger: budget } = await ledger({ maxModelCalls: 3, maxOutputTokens: 300 });
    await invokeAndSettle(budget, { kind: "initial", providerRunId: "attempt-0" }, 10);
    await invokeAndSettle(budget, { kind: "retry", providerRunId: "attempt-1" }, 10);
    await invokeAndSettle(budget, { kind: "retry", providerRunId: "attempt-2" }, 10);
    await expect(
      budget.admitModelCall(admission({ kind: "retry", providerRunId: "attempt-3" })),
    ).rejects.toMatchObject({ reason: "MODEL_CALL_BUDGET_EXHAUSTED" });
    expect(budget.projectAgentRun("agent-run-1")).toMatchObject({
      modelCallsInitiated: 3,
      retryCount: 2,
    });
  });

  it("preserves the same remaining budget across a provider switch", async () => {
    const { ledger: budget } = await ledger({ maxModelCalls: 5, maxOutputTokens: 4_000 });
    await invokeAndSettle(
      budget,
      {
        provider: "claude",
        providerRunId: "claude-1",
        requestedOutputTokenAllowance: 1_000,
        providerHardCap: 1_000,
      },
      600,
    );
    await invokeAndSettle(
      budget,
      {
        provider: "claude",
        providerRunId: "claude-2",
        requestedOutputTokenAllowance: 1_000,
        providerHardCap: 1_000,
      },
      600,
    );
    expect(budget.snapshot()).toMatchObject({
      modelCallsRemaining: 3,
      outputTokensRemaining: 2_800,
    });
    const codex = await budget.admitModelCall(
      admission({
        provider: "codex",
        resolvedModelId: "codex-test",
        providerRunId: "codex-fallback",
        kind: "fallback",
        providerTransitionFrom: "claude",
        requestedOutputTokenAllowance: 2_800,
        providerHardCap: 2_800,
      }),
    );
    expect(codex.outputTokenAllowance).toBe(2_800);
    expect(codex.providerTransitionFrom).toBe("claude");
  });

  it("charges model re-entry while a local tool operation consumes no call", async () => {
    const { ledger: budget } = await ledger({ maxModelCalls: 2, maxOutputTokens: 200 });
    await invokeAndSettle(budget, { kind: "initial", providerRunId: "before-tool" }, 10);
    const afterLocalTool = budget.snapshot();
    expect(afterLocalTool.modelCallsInitiated).toBe(1);
    await invokeAndSettle(budget, { kind: "model-reentry", providerRunId: "after-tool" }, 10);
    expect(budget.snapshot().modelCallsInitiated).toBe(2);
  });

  it("projects multiple ProviderRuns and providers from one AgentRun without resetting", async () => {
    const { ledger: budget } = await ledger({ maxModelCalls: 3, maxOutputTokens: 300 });
    await invokeAndSettle(budget, { provider: "claude", providerRunId: "provider-claude" }, 20);
    await invokeAndSettle(
      budget,
      { provider: "codex", providerRunId: "provider-codex", kind: "fallback" },
      30,
    );
    expect(budget.projectAgentRun("agent-run-1")).toEqual({
      modelCallsInitiated: 2,
      retryCount: 0,
      observedOutputTokens: 50,
      policyChargedOutputTokens: 50,
      providerRunIds: ["provider-claude", "provider-codex"],
    });
  });

  it("keeps an internal child/subagent on the parent execution lineage", async () => {
    const { ledger: budget } = await ledger({ maxModelCalls: 2, maxOutputTokens: 200 });
    await invokeAndSettle(budget, { agentRunId: "parent-agent", providerRunId: "parent-run" }, 10);
    await invokeAndSettle(
      budget,
      { agentRunId: "child-agent", providerRunId: "child-run", kind: "internal" },
      10,
    );
    expect(budget.snapshot()).toMatchObject({
      modelCallsInitiated: 2,
      modelCallsRemaining: 0,
      policyChargedOutputTokens: 20,
    });
    expect(budget.projectAgentRun("child-agent").modelCallsInitiated).toBe(1);
    await expect(
      budget.admitModelCall(
        admission({ agentRunId: "another-child", providerRunId: "another-child-run" }),
      ),
    ).rejects.toMatchObject({ reason: "MODEL_CALL_BUDGET_EXHAUSTED" });
  });
});

describe("streaming-equivalent and crash recovery semantics", () => {
  it("uses only authoritative terminal cumulative usage and never sums duplicates", async () => {
    const { ledger: budget } = await ledger({ maxModelCalls: 1, maxOutputTokens: 500 });
    const reservation = await budget.admitModelCall(
      admission({ kind: "stream", requestedOutputTokenAllowance: 500, providerHardCap: 500 }),
    );
    await budget.markInvoked(reservation.budgetReservationId);
    await budget.observeStreamingCumulativeUsage(reservation.budgetReservationId, 40);
    await budget.observeStreamingCumulativeUsage(reservation.budgetReservationId, 120);
    await budget.observeStreamingCumulativeUsage(reservation.budgetReservationId, 120);
    expect(budget.snapshot()).toMatchObject({
      outputTokensReserved: 500,
      observedOutputTokens: null,
      policyChargedOutputTokens: 0,
      reservations: [{ latestCumulativeOutputTokens: 120 }],
    });
    await budget.settleAuthoritative(reservation.budgetReservationId, 120);
    await budget.settleAuthoritative(reservation.budgetReservationId, 120);
    expect(budget.snapshot()).toMatchObject({
      observedOutputTokens: 120,
      policyChargedOutputTokens: 120,
      outputTokensRemaining: 380,
    });
  });

  it("charges the full streaming reservation on cancellation/disconnect", async () => {
    const { ledger: budget } = await ledger({ maxModelCalls: 1, maxOutputTokens: 500 });
    const reservation = await budget.admitModelCall(
      admission({ kind: "stream", requestedOutputTokenAllowance: 500, providerHardCap: 500 }),
    );
    await budget.markInvoked(reservation.budgetReservationId);
    await budget.settleConservative(
      reservation.budgetReservationId,
      80,
      "stream-cancelled-before-terminal-usage",
    );
    expect(budget.snapshot()).toMatchObject({
      observedOutputTokens: 80,
      policyChargedOutputTokens: 500,
      outputTokensRemaining: 0,
    });
  });

  it("recovers PENDING as cancelled and INVOKED as a full conservative charge", async () => {
    const store = new InMemoryExecutionBudgetEvidenceStore();
    const authority = await lineage({ maxModelCalls: 2, maxOutputTokens: 300 });
    const original = await ExecutionBudgetLedger.create(authority, store, {
      now: clock(),
      reservationId: idFactory("recovery"),
    });
    await original.admitModelCall(
      admission({
        providerRunId: "pending",
        requestedOutputTokenAllowance: 100,
        providerHardCap: 100,
      }),
    );
    const invoked = await original.admitModelCall(
      admission({
        providerRunId: "invoked",
        requestedOutputTokenAllowance: 200,
        providerHardCap: 200,
      }),
    );
    await original.markInvoked(invoked.budgetReservationId);

    const recovered = await ExecutionBudgetLedger.recover(authority, store, { now: clock() });
    expect(recovered.snapshot()).toMatchObject({
      modelCallsInitiated: 1,
      modelCallsReserved: 0,
      outputTokensReserved: 0,
      observedOutputTokens: null,
      policyChargedOutputTokens: 200,
    });
    expect(recovered.snapshot().reservations.map(({ state }) => state)).toEqual([
      "CANCELLED_BEFORE_INVOCATION",
      "SETTLED_CONSERVATIVE",
    ]);
  });

  it("persists only bounded metadata in a per-lineage fsync-backed NDJSON journal", async () => {
    const root = await mkdtemp(join(tmpdir(), "beacon-budget-ledger-"));
    const store = new AppendOnlyNdjsonExecutionBudgetEvidenceStore(root);
    const authority = await lineage();
    const budget = await ExecutionBudgetLedger.create(authority, store, {
      now: clock(),
      reservationId: idFactory("durable"),
    });
    await invokeAndSettle(budget, {}, 25);
    const path = join(root, hashLineagePath(authority.budgetLineageId), "journal.ndjson");
    const source = await readFile(path, "utf8");
    expect(source).toContain("budget-lineage-test");
    expect(source).toContain("SETTLED_AUTHORITATIVE");
    expect(source).not.toContain("prompt");
    expect(source).not.toContain("response");
    expect(source).not.toContain("credential");
  });
});

describe("B1/B4/B5 fix: cross-process writer/fencing and transactional durability", () => {
  it("allows only one of two simultaneous create() calls for the same lineage", async () => {
    const root = await mkdtemp(join(tmpdir(), "beacon-budget-fencing-"));
    const authority = await lineage({ budgetLineageId: "concurrent-create-lineage" });
    const results = await Promise.allSettled([
      ExecutionBudgetLedger.create(
        authority,
        new AppendOnlyNdjsonExecutionBudgetEvidenceStore(root),
      ),
      ExecutionBudgetLedger.create(
        authority,
        new AppendOnlyNdjsonExecutionBudgetEvidenceStore(root),
      ),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const [rejected] = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(rejected.reason).toBeInstanceOf(ExecutionBudgetWriterLeaseUnavailableError);
  });

  it("allows only one of two simultaneous recover() calls for the same lineage", async () => {
    const root = await mkdtemp(join(tmpdir(), "beacon-budget-fencing-"));
    const authority = await lineage({ budgetLineageId: "concurrent-recover-lineage" });
    const seedStore = new AppendOnlyNdjsonExecutionBudgetEvidenceStore(root, { ttlMs: 5 });
    const seed = await ExecutionBudgetLedger.create(authority, seedStore);
    await seed.admitModelCall(admission());
    await new Promise((resolve) => setTimeout(resolve, 30)); // let the seed writer's lease expire
    // The two racing recoveries use a generous TTL so that whichever wins the
    // takeover is never itself mistaken for stale by the other mid-race --
    // only the original seed writer's lease is meant to be expired here.
    const results = await Promise.allSettled([
      ExecutionBudgetLedger.recover(
        authority,
        new AppendOnlyNdjsonExecutionBudgetEvidenceStore(root),
      ),
      ExecutionBudgetLedger.recover(
        authority,
        new AppendOnlyNdjsonExecutionBudgetEvidenceStore(root),
      ),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const [rejected] = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(rejected.reason).toBeInstanceOf(ExecutionBudgetWriterLeaseUnavailableError);
  });

  it("fails a stale writer's ledger mutation closed immediately after a governed takeover", async () => {
    const root = await mkdtemp(join(tmpdir(), "beacon-budget-fencing-"));
    const authority = await lineage({ budgetLineageId: "stale-writer-lineage" });
    // A short TTL stands in for "Process A becomes stale/suspended" without a
    // real multi-second sleep -- the fence recheck, not the TTL, is what
    // actually protects correctness (Section 4/5).
    const staleWriter = await ExecutionBudgetLedger.create(
      authority,
      new AppendOnlyNdjsonExecutionBudgetEvidenceStore(root, { ttlMs: 5 }),
    );
    await new Promise((resolve) => setTimeout(resolve, 30));
    // Process B legitimately recovers and takes over with a brand-new fence.
    await ExecutionBudgetLedger.recover(
      authority,
      new AppendOnlyNdjsonExecutionBudgetEvidenceStore(root, { ttlMs: 5 }),
    );
    // Process A wakes up and tries to keep mutating -- it must fail closed
    // rather than silently continue as if it still owned the lineage.
    await expect(staleWriter.admitModelCall(admission())).rejects.toBeInstanceOf(
      ExecutionBudgetWriterFenceError,
    );
    await expect(staleWriter.assertWriterAuthority()).rejects.toBeInstanceOf(
      ExecutionBudgetWriterFenceError,
    );
  });

  it("poisons the ledger and blocks all further mutation when durable persistence becomes uncertain", async () => {
    const snapshots: ExecutionBudgetLedgerSnapshot[] = [];
    let appendCount = 0;
    const store: ExecutionBudgetEvidenceStore = {
      durability: "fsync-journal",
      async append(snapshot) {
        appendCount += 1;
        // Allow revision 0 (create) and revision 1 (admission) to succeed;
        // fail durably starting with markInvoked's persist attempt.
        if (appendCount > 2) {
          throw new ExecutionBudgetEvidencePersistenceError(
            "Synthetic fsync failure.",
            new Error("disk unavailable"),
          );
        }
        snapshots.push(structuredClone(snapshot));
      },
      async load(budgetLineageId) {
        return snapshots.filter((snapshot) => snapshot.lineage.budgetLineageId === budgetLineageId);
      },
    };
    const budget = await ExecutionBudgetLedger.create(await lineage(), store, {
      now: clock(),
      reservationId: idFactory(),
    });
    const reservation = await budget.admitModelCall(admission());
    await expect(budget.markInvoked(reservation.budgetReservationId)).rejects.toBeInstanceOf(
      ExecutionBudgetEvidencePersistenceError,
    );
    // The ledger is now poisoned: no further admission, settlement, or
    // provider invocation may proceed from ambiguous in-memory state.
    await expect(
      budget.admitModelCall(admission({ providerRunId: "after-poison" })),
    ).rejects.toBeInstanceOf(ExecutionBudgetPoisonedError);
    await expect(budget.assertWriterAuthority()).rejects.toBeInstanceOf(
      ExecutionBudgetPoisonedError,
    );
  });

  it("keeps a lineage permanently blocked when VIOLATION persistence itself fails", async () => {
    const snapshots: ExecutionBudgetLedgerSnapshot[] = [];
    let appendCount = 0;
    const store: ExecutionBudgetEvidenceStore = {
      durability: "fsync-journal",
      async append(snapshot) {
        appendCount += 1;
        if (appendCount > 3) {
          throw new ExecutionBudgetEvidencePersistenceError(
            "Synthetic journal failure.",
            new Error("io"),
          );
        }
        snapshots.push(structuredClone(snapshot));
      },
      async load(budgetLineageId) {
        return snapshots.filter((snapshot) => snapshot.lineage.budgetLineageId === budgetLineageId);
      },
    };
    const budget = await ExecutionBudgetLedger.create(
      await lineage({ maxModelCalls: 2, maxOutputTokens: 200 }),
      store,
      { now: clock(), reservationId: idFactory() },
    );
    const reservation = await budget.admitModelCall(admission());
    await budget.markInvoked(reservation.budgetReservationId);
    await expect(
      budget.settleAuthoritative(reservation.budgetReservationId, 999),
    ).rejects.toBeInstanceOf(ExecutionBudgetEvidencePersistenceError);
    await expect(
      budget.admitModelCall(admission({ providerRunId: "post-violation" })),
    ).rejects.toBeInstanceOf(ExecutionBudgetPoisonedError);
  });

  it("never lets a smaller terminal settlement overwrite a larger streaming-observed cumulative usage", async () => {
    const { ledger: budget } = await ledger({ maxModelCalls: 1, maxOutputTokens: 500 });
    const reservation = await budget.admitModelCall(
      admission({ kind: "stream", requestedOutputTokenAllowance: 500, providerHardCap: 500 }),
    );
    await budget.markInvoked(reservation.budgetReservationId);
    await budget.observeStreamingCumulativeUsage(reservation.budgetReservationId, 120);
    // A terminal settlement racing behind the streaming observation must never
    // charge less than what was already durably observed (B5).
    await budget.settleAuthoritative(reservation.budgetReservationId, 40);
    expect(budget.snapshot()).toMatchObject({
      policyChargedOutputTokens: 500,
      reservations: [{ state: "SETTLED_CONSERVATIVE" }],
    });
  });

  it("refuses to reuse a providerRunId for a second reservation", async () => {
    const { ledger: budget } = await ledger({ maxModelCalls: 2, maxOutputTokens: 200 });
    await invokeAndSettle(budget, { providerRunId: "reused-run" }, 10);
    await expect(
      budget.admitModelCall(admission({ providerRunId: "reused-run" })),
    ).rejects.toBeInstanceOf(ExecutionBudgetStateError);
  });
});
