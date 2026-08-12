import { z } from "astro/zod";

/**
 * The three projections Section 24 of the Phase 1.6 master spec defines: Beacon
 * Lab/Brain (private by default), Decisions/Docs (internal/canonical), and Building
 * Beacon (public curated). This is a distinct axis from
 * `DataClassificationSchema` (src/modules/orchestration/domain/work-request.ts:
 * public/internal/confidential/restricted), which classifies *sensitivity*, not
 * *audience/projection*. Entities that hold sensitive content use both fields.
 *
 * No default is baked into this schema itself -- callers apply
 * `defaultToPrivateVisibility` (./authority.ts) explicitly at each site that needs
 * the Section 5 / Section 27 "private by default" rule, so the default is visible in
 * code rather than a hidden schema-level behavior.
 */
export const EventVisibilitySchema = z.enum(["private", "internal", "public"]);
export type EventVisibility = z.infer<typeof EventVisibilitySchema>;

/**
 * Section 9's freshness classes. "Ephemeral" is the class Section 29A binds
 * continuity/gate/capacity state to -- see continuation.ts.
 */
export const FreshnessClassSchema = z.enum([
  "foundational",
  "slow-changing",
  "current",
  "fast-changing",
  "ephemeral",
]);
export type FreshnessClass = z.infer<typeof FreshnessClassSchema>;
