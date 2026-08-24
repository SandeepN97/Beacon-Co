import { z } from "astro/zod";
import { assertValidAdrTransition, type AdrLifecycleStatus } from "./lifecycle.ts";

/**
 * Section 1A's Architectural Invariants registry, scoped exactly to PR-0A's
 * ADR-0021 bound: automated enforcement for INV-001, INV-002, INV-003,
 * INV-006, INV-007, INV-008, and INV-010 only. The full twelve-row table is
 * still listed below for completeness (matching Section 1A itself), but the
 * remaining five (INV-004, INV-005, INV-009, INV-011, INV-012) carry
 * `enforcedInPR0A: false` and no enforcement function here -- each activates
 * only in the PR that introduces the entity it governs (Section 31's own
 * rule: "the PR that introduces the capability also activates its
 * invariant"), which is not this one.
 */

export const InvariantIdSchema = z.enum([
  "INV-001",
  "INV-002",
  "INV-003",
  "INV-004",
  "INV-005",
  "INV-006",
  "INV-007",
  "INV-008",
  "INV-009",
  "INV-010",
  "INV-011",
  "INV-012",
]);
export type InvariantId = z.infer<typeof InvariantIdSchema>;

export interface InvariantDefinition {
  id: InvariantId;
  statement: string;
  source: string;
  enforcedInPR0A: boolean;
}

/** Section 1A's table, verbatim statements and sources. */
export const ARCHITECTURAL_INVARIANTS: readonly InvariantDefinition[] = [
  {
    id: "INV-001",
    statement: "Provider context MUST NOT become canonical Beacon memory.",
    source: "Section 6, Section 29",
    enforcedInPR0A: true,
  },
  {
    id: "INV-002",
    statement: "Only an accepted ADR may authorize Phase 1.5 execution.",
    source: "Section 19's authority invariant",
    enforcedInPR0A: true,
  },
  {
    id: "INV-003",
    statement: "An accepted ADR MUST NOT be mutated. Superseding decisions create a new ADR.",
    source: "Section 19A",
    enforcedInPR0A: true,
  },
  {
    id: "INV-004",
    statement: "Every research-derived claim MUST have traceable evidence provenance.",
    source: "Section 10, Section 21",
    enforcedInPR0A: false,
  },
  {
    id: "INV-005",
    statement: "UnderstandingVersion N MUST remain addressable after N+1 exists.",
    source: "Section 11",
    enforcedInPR0A: false,
  },
  {
    id: "INV-006",
    statement: "Ephemeral continuation state MUST be revalidated before authorization use.",
    source: "Section 29A.2's binding revalidation rule",
    enforcedInPR0A: true,
  },
  {
    id: "INV-007",
    statement:
      "Provider eligibility MUST be evaluated against data classification before provider selection.",
    source: "Section 29B.5 step 2; formalized in Section 27A",
    enforcedInPR0A: true,
  },
  {
    id: "INV-008",
    statement: "An untrusted adapter MUST NOT receive capabilities above its trust tier.",
    source: "Section 29B.4",
    enforcedInPR0A: true,
  },
  {
    id: "INV-009",
    statement: "Public projections MUST NOT bypass canonical privacy/authority gates.",
    source: "Section 24, Section 27",
    enforcedInPR0A: false,
  },
  {
    id: "INV-010",
    statement: "Free-tier or experimental providers MUST NOT possess release authority.",
    source: "Section 29B.3 (release: locked, paid-only)",
    enforcedInPR0A: true,
  },
  {
    id: "INV-011",
    statement:
      "Phase 1.5 MUST receive a bounded DecisionPackage, not the full research transcript.",
    source: "Section 20",
    enforcedInPR0A: false,
  },
  {
    id: "INV-012",
    statement: "Production outcomes MUST remain capable of generating new understanding.",
    source: "Section 4 step 12, Section 21",
    enforcedInPR0A: false,
  },
] as const;

export function invariant(id: InvariantId): InvariantDefinition {
  const found = ARCHITECTURAL_INVARIANTS.find((entry) => entry.id === id);
  if (!found) throw new Error(`unknown invariant id: ${id}`);
  return found;
}

// --- INV-001 ---

/**
 * Section 6's four-layer memory table: "Provider context | Claude/Codex
 * working windows, tool context, scratch computation. | Ephemeral
 * optimization; never authoritative." This checks a schema's own field
 * names for anything that looks like raw provider-context data being
 * smuggled into canonical storage -- a structural regression guard: any
 * future KnowledgeEvent payload schema shape can be checked against the
 * same denylist, not just the ones that exist today. A denylist is
 * necessarily partial (it cannot catch every possible future field name),
 * so this is a real but incomplete guard, not a proof of compliance.
 */
const RAW_PROVIDER_CONTEXT_FIELD_PATTERN =
  /rawTranscript|rawProviderContext|providerSession|scratchComputation|workingWindow|toolContextRaw/i;

export function assertNoRawProviderContextField(shape: Record<string, unknown>): void {
  const offending = Object.keys(shape).filter((key) =>
    RAW_PROVIDER_CONTEXT_FIELD_PATTERN.test(key),
  );
  if (offending.length > 0) {
    throw new Error(
      `INV-001 violation: field(s) ${offending.join(", ")} look like raw provider context (Section 6: "Ephemeral optimization; never authoritative") being stored on a canonical schema`,
    );
  }
}

// --- INV-002 ---

/**
 * Already implemented and tested: Section 19's authority invariant is
 * exactly what ./authority.ts's `assertExecutionAuthorized` enforces (see
 * that file's own doc comment, which quotes Section 19 verbatim). PR-0A
 * registers it here rather than reimplementing it -- Section 35.1's "extend
 * existing systems" rule applies to this repo's own already-merged PR-0
 * code, not only to the master spec's systems.
 */
export { assertExecutionAuthorized } from "./authority.ts";

// --- INV-003 ---

/**
 * "An accepted ADR MUST NOT be mutated" is exactly the ADR lifecycle's own
 * transition guard (./lifecycle.ts): there is no accepted -> accepted
 * transition, so attempting to "edit" an accepted ADR is rejected as an
 * illegal transition, not specially cased here.
 */
export function assertAdrNotMutatedOnceAccepted(
  from: AdrLifecycleStatus,
  to: AdrLifecycleStatus,
): void {
  assertValidAdrTransition(from, to);
}

// --- INV-006 ---

export interface RevalidatableGateEvidence {
  gate: string;
  boundCandidateSha: string | null;
}

/**
 * Section 29A.2's binding revalidation rule: "Any consumer of a
 * ContinuationPackage -- human or agent -- MUST treat its readiness/gate
 * fields as untrusted once observedAt + staleAfter has passed, and MUST
 * re-run the live source-of-truth check ... before acting on them."
 * Generalized here to the SHA-bound half of that rule, which this repo
 * already enforces operationally in
 * ../broker/continuation-manager.ts's `ContinuationManager.forCandidate`
 * (evidence bound to a stale candidate SHA is dropped back to outstanding
 * rather than trusted). This function states the same rule independently
 * of that concrete implementation, so it can be applied to any gate
 * evidence shape, not only Phase 1.5's specific ContinuationPackage type.
 */
export function assertGateEvidenceRevalidated(
  evidence: RevalidatableGateEvidence,
  currentCandidateSha: string,
): void {
  if (evidence.boundCandidateSha !== null && evidence.boundCandidateSha !== currentCandidateSha) {
    throw new Error(
      `INV-006 violation: gate "${evidence.gate}" evidence is bound to candidate ${evidence.boundCandidateSha}, not the current candidate ${currentCandidateSha} -- it must be revalidated before being trusted (Section 29A.2)`,
    );
  }
}

// --- INV-007 ---

/** Section 27A's Data Classification Matrix row headers, verbatim. */
export const SpecDataClassificationSchema = z.enum([
  "public",
  "internal",
  "confidential",
  "secrets",
  "production-credentials",
]);
export type SpecDataClassification = z.infer<typeof SpecDataClassificationSchema>;

/**
 * Section 27A's Data Classification Matrix column headers, verbatim. Note:
 * this repo's existing WorkRequestSchema.dataClassification (domain/
 * work-request.ts) uses a different, four-value taxonomy ("public" |
 * "internal" | "confidential" | "restricted") that does not distinguish
 * "secrets" from "production-credentials" the way Section 27A's table
 * does. That reconciliation is out of scope for PR-0A -- this type models
 * Section 27A's matrix as published, not the existing Phase 1.5 field.
 */
export const SpecTrustColumnSchema = z.enum([
  "paid-trusted-t1",
  "vetted-free-t1-equivalent",
  "experimental-t3",
  "public",
]);
export type SpecTrustColumn = z.infer<typeof SpecTrustColumnSchema>;

type DataClassificationEligibility =
  "eligible" | "ineligible" | "policy-gated" | "approved-only" | "role-controlled";

/** Section 27A's matrix cells, transcribed exactly (✓ = eligible, ✗ = ineligible). */
const DATA_CLASSIFICATION_MATRIX: Record<
  SpecDataClassification,
  Record<SpecTrustColumn, DataClassificationEligibility>
> = {
  public: {
    "paid-trusted-t1": "eligible",
    "vetted-free-t1-equivalent": "eligible",
    "experimental-t3": "eligible",
    public: "eligible",
  },
  internal: {
    "paid-trusted-t1": "eligible",
    "vetted-free-t1-equivalent": "policy-gated",
    "experimental-t3": "ineligible",
    public: "ineligible",
  },
  confidential: {
    "paid-trusted-t1": "approved-only",
    "vetted-free-t1-equivalent": "ineligible",
    "experimental-t3": "ineligible",
    public: "ineligible",
  },
  secrets: {
    "paid-trusted-t1": "ineligible",
    "vetted-free-t1-equivalent": "ineligible",
    "experimental-t3": "ineligible",
    public: "ineligible",
  },
  "production-credentials": {
    "paid-trusted-t1": "role-controlled",
    "vetted-free-t1-equivalent": "ineligible",
    "experimental-t3": "ineligible",
    public: "ineligible",
  },
};

export function dataClassificationEligibility(
  dataClassification: SpecDataClassification,
  trustColumn: SpecTrustColumn,
): DataClassificationEligibility {
  return DATA_CLASSIFICATION_MATRIX[dataClassification][trustColumn];
}

/**
 * Section 27A's binding rule: "A provider fails eligibility at step 2 --
 * before task-class lookup, before health, before cost -- if the WorkUnit's
 * data classification is not permitted for that provider's trust tier. No
 * downstream ranking criterion can override a step-2 failure." Only
 * "eligible" clears step 2 outright; "policy-gated" / "approved-only" /
 * "role-controlled" require the caller to have already satisfied that
 * specific named gate -- this function does not silently treat them as a
 * pass, only "ineligible" throws here.
 */
export function assertProviderEligibleForDataClassification(
  dataClassification: SpecDataClassification,
  trustColumn: SpecTrustColumn,
): void {
  const eligibility = dataClassificationEligibility(dataClassification, trustColumn);
  if (eligibility === "ineligible") {
    throw new Error(
      `INV-007 violation: "${trustColumn}" is not eligible for "${dataClassification}" data (Section 27A step-2 eligibility) -- no downstream ranking criterion can override this`,
    );
  }
}

// --- INV-008 ---

/** Section 29B.4's trust tiers, verbatim tier identifiers. */
export const AdapterTrustTierSchema = z.enum(["T0", "T1", "T1-equivalent", "T2", "T3", "T4"]);
export type AdapterTrustTier = z.infer<typeof AdapterTrustTierSchema>;

export const AdapterCapabilitySchema = z.enum([
  "none",
  "read-only",
  "sandboxed-write",
  "normal-repo-write",
  "secrets-access",
  "production-deploy",
]);
export type AdapterCapability = z.infer<typeof AdapterCapabilitySchema>;

const CAPABILITY_RANK: Record<AdapterCapability, number> = {
  none: 0,
  "read-only": 1,
  "sandboxed-write": 2,
  "normal-repo-write": 3,
  "secrets-access": 4,
  "production-deploy": 5,
};

/**
 * Section 29B.4's "Allowed capability" column, transcribed as an ordered
 * ceiling per tier. T0 is deterministic (tests/linters/schema validation --
 * "No LLM involved; always eligible") and never makes an LLM-capability
 * request in the sense this ceiling models, so it is capped at "none" here
 * for that purpose without contradicting its own "always eligible" rule for
 * its actual (non-LLM) operation.
 */
const CAPABILITY_CEILING: Record<AdapterTrustTier, AdapterCapability> = {
  T0: "none",
  T1: "production-deploy",
  "T1-equivalent": "sandboxed-write",
  T2: "sandboxed-write",
  T3: "read-only",
  T4: "none",
};

export function assertCapabilityWithinTrustTier(
  tier: AdapterTrustTier,
  requested: AdapterCapability,
): void {
  const ceiling = CAPABILITY_CEILING[tier];
  if (CAPABILITY_RANK[requested] > CAPABILITY_RANK[ceiling]) {
    throw new Error(
      `INV-008 violation: tier "${tier}" is capped at "${ceiling}" (Section 29B.4) but capability "${requested}" was requested`,
    );
  }
}

// --- INV-010 ---

/**
 * Section 29B.3's Release row: "release-manager | Locked | Claude / Codex
 * only | Never free-tier, at any risk tier, at any capacity state." Release
 * authority requires exactly T1 -- Section 29B.4 confirms T1's backend
 * examples are "n/a -- paid providers only."
 */
export function assertReleaseAuthorityRestrictedToPaidTier(tier: AdapterTrustTier): void {
  if (tier !== "T1") {
    throw new Error(
      `INV-010 violation: trust tier "${tier}" cannot hold release authority -- Section 29B.3 requires T1 (Claude/Codex, paid) at any risk tier and any capacity state`,
    );
  }
}
