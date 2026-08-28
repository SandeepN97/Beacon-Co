import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "astro/zod";
import { assertExecutionAuthorized } from "../decision-os/authority.ts";
import type { AdrRef } from "../decision-os/decision.ts";

/**
 * Fixes B2 (independent security review of PR #83, candidate
 * e895f60e72f912221b7bf9d001d8aa49bdd993eb): `authorizeExecutionBudgetLineage`
 * used to accept a caller-supplied `authorizedBy`/`authorizationEvidenceId` pair
 * of bare strings. Any caller -- a provider adapter, a retry path, a test
 * fixture -- could mint one, so nothing was actually being authorized.
 *
 * This module is the smallest trusted abstraction the corrective mission asks
 * for: `ExecutionBudgetAuthorityGrant` can only be constructed by `issue()`,
 * and `issue()` requires the *existing* Decision OS authority boundary
 * (`assertExecutionAuthorized`, Section 19's invariant -- "only an accepted ADR
 * authorizes execution") to accept the caller's AdrRef, and additionally binds
 * that AdrRef to a real, git-tracked ADR document already present in this
 * repository under `src/content/docs/decisions/`. A caller cannot fabricate
 * approval by constructing an in-memory object with `status: "accepted"`
 * alone: `adrId` must name a real decision record whose committed frontmatter
 * independently says `status: "approved"`. Neither check replaces the other.
 *
 * What this deliberately does NOT do: resolve `decisionCandidateRef` against a
 * durable Decision OS event/evidence store proving *how* that ADR came to be
 * accepted. No such durable, tamper-evident store exists yet for Phase 1.6 --
 * the repository's own README records "Decision OS / Phase 1.6: ... authority
 * invariants are not yet complete" -- and building one is a genuinely new
 * architecture decision, not a bounded Phase 1.5 correction. That residual gap
 * is Decision OS's, not this ledger's, and is reported honestly rather than
 * silently assumed away.
 */

const WorkUnitIdSchema = z.string().min(1).max(160);
const PositiveIntegerSchema = z.number().int().positive();

export class ExecutionBudgetAuthorityGrantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecutionBudgetAuthorityGrantError";
  }
}

export interface ExecutionBudgetAuthorityGrantInput {
  /** Parsed with assertExecutionAuthorized -- must be a real AdrRef with status "accepted". */
  adrRef: unknown;
  workUnitId: string;
  maxModelCalls: number;
  maxOutputTokens: number;
  /** e.g. "agent-platform/model-policy.yml#code-writer" -- where the ceiling came from. */
  policySource: string;
  grantedAt: string;
  /** Injectable for tests; defaults to the real repository root. */
  repositoryRoot?: string;
}

export class ExecutionBudgetAuthorityGrant {
  readonly adrRef: AdrRef;
  readonly workUnitId: string;
  readonly maxModelCalls: number;
  readonly maxOutputTokens: number;
  readonly policySource: string;
  readonly grantedAt: string;
  readonly authorizationEvidenceId: string;

  private constructor(
    adrRef: AdrRef,
    workUnitId: string,
    maxModelCalls: number,
    maxOutputTokens: number,
    policySource: string,
    grantedAt: string,
    authorizationEvidenceId: string,
  ) {
    this.adrRef = adrRef;
    this.workUnitId = workUnitId;
    this.maxModelCalls = maxModelCalls;
    this.maxOutputTokens = maxOutputTokens;
    this.policySource = policySource;
    this.grantedAt = grantedAt;
    this.authorizationEvidenceId = authorizationEvidenceId;
  }

  static async issue(
    input: ExecutionBudgetAuthorityGrantInput,
  ): Promise<ExecutionBudgetAuthorityGrant> {
    const adrRef = assertExecutionAuthorized(input.adrRef);
    await assertAdrIsReallyApproved(adrRef.adrId, input.repositoryRoot);
    const workUnitId = WorkUnitIdSchema.parse(input.workUnitId);
    const maxModelCalls = PositiveIntegerSchema.parse(input.maxModelCalls);
    const maxOutputTokens = PositiveIntegerSchema.parse(input.maxOutputTokens);
    if (typeof input.policySource !== "string" || input.policySource.length === 0) {
      throw new ExecutionBudgetAuthorityGrantError("A policySource provenance string is required.");
    }
    if (typeof input.grantedAt !== "string" || Number.isNaN(Date.parse(input.grantedAt))) {
      throw new ExecutionBudgetAuthorityGrantError("grantedAt must be a valid timestamp.");
    }
    const authorizationEvidenceId = createHash("sha256")
      .update(
        JSON.stringify({
          adrId: adrRef.adrId,
          decisionCandidateRef: adrRef.decisionCandidateRef,
          workUnitId,
          maxModelCalls,
          maxOutputTokens,
          policySource: input.policySource,
          grantedAt: input.grantedAt,
        }),
      )
      .digest("hex");
    return new ExecutionBudgetAuthorityGrant(
      adrRef,
      workUnitId,
      maxModelCalls,
      maxOutputTokens,
      input.policySource,
      input.grantedAt,
      authorizationEvidenceId,
    );
  }
}

function parseFrontmatterStatus(source: string): string | null {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return null;
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    if (key !== "status") continue;
    return line
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return null;
}

/** Repository-relative documented-approval statuses; see src/content.config.ts. */
const DOCUMENTED_APPROVED_STATUS = "approved";

async function assertAdrIsReallyApproved(adrId: string, repositoryRoot?: string): Promise<void> {
  const root = repositoryRoot ?? process.cwd();
  const path = join(root, "src", "content", "docs", "decisions", `${adrId}.mdoc`);
  let source: string;
  try {
    source = await readFile(path, "utf8");
  } catch {
    throw new ExecutionBudgetAuthorityGrantError(
      `ADR ${adrId} does not correspond to a real, committed decision record at ${path}; refusing to mint execution-budget authority from an unbacked reference.`,
    );
  }
  const status = parseFrontmatterStatus(source);
  if (status !== DOCUMENTED_APPROVED_STATUS) {
    throw new ExecutionBudgetAuthorityGrantError(
      `ADR ${adrId}'s committed record has status "${status ?? "unknown"}", not "${DOCUMENTED_APPROVED_STATUS}"; execution is not authorized.`,
    );
  }
}
