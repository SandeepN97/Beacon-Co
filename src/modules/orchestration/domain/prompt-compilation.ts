import { z } from "astro/zod";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const PromptCompilationSchema = z
  .object({
    schemaVersion: z.literal(1),
    contextPackageId: z.string().min(1).max(160),
    stablePrefix: z.string().min(1),
    variableContext: z.string().min(1),
    stablePrefixHash: Sha256Schema,
    variableContextHash: Sha256Schema,
    compilationHash: Sha256Schema,
    totalBytes: z.number().int().positive(),
    estimatedInputTokens: z.number().int().positive(),
  })
  .strict();

export type PromptCompilation = z.infer<typeof PromptCompilationSchema>;

export function validatePromptCompilation(input: unknown): PromptCompilation {
  return PromptCompilationSchema.parse(input);
}
