import { z } from "astro/zod";

const BoundedLinesSchema = z.array(z.string().trim().min(1).max(1_000)).min(1).max(30);

export const PublicationManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    title: z.string().trim().min(8).max(120),
    summary: BoundedLinesSchema,
    risk: BoundedLinesSchema,
    testEvidence: BoundedLinesSchema,
    documentationImpact: BoundedLinesSchema,
    rollback: BoundedLinesSchema,
    allowedPathPrefixes: z.array(z.string().trim().min(1).max(300)).min(1).max(100),
  })
  .strict();

export type PublicationManifest = z.infer<typeof PublicationManifestSchema>;

const section = (heading: string, lines: string[]) =>
  `${heading}\n\n${lines.map((line) => `- ${line}`).join("\n")}`;

export function renderPullRequestBody(input: unknown, machineEvidence: string[] = []): string {
  const manifest = PublicationManifestSchema.parse(input);
  return `${[
    section("## Summary", manifest.summary),
    section("## Risk", manifest.risk),
    section("## Test evidence", [...manifest.testEvidence, ...machineEvidence]),
    section("## Documentation impact", manifest.documentationImpact),
    section("## Rollback", manifest.rollback),
  ].join("\n\n")}\n`;
}

export function pathMatchesPublicationScope(path: string, manifest: PublicationManifest): boolean {
  return manifest.allowedPathPrefixes.some(
    (prefix) => path === prefix || path.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`),
  );
}
