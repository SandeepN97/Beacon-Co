import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

export const documentationStatuses = [
  "draft",
  "under-review",
  "approved",
  "superseded",
] as const;

const docs = defineCollection({
  loader: glob({
    pattern: "**/*.mdoc",
    base: "./src/content/docs",
  }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    section: z.string().min(1),
    order: z.number().int().nonnegative(),
    status: z.enum(documentationStatuses),
    lastReviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    owners: z.array(z.string()).min(1),
    sourceFiles: z.array(z.string()),
    relatedAdrs: z.array(z.string()),
    relatedPages: z.array(z.string()),
    tags: z.array(z.string()),
    truthState: z
      .enum(["current", "target", "proposal", "decision", "reference"])
      .default("reference"),
  }),
});

export const collections = { docs };
