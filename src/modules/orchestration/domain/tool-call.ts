import { z } from "astro/zod";
import { AgentRoleSchema } from "./agent-run.ts";

export const ToolPolicyRequestSchema = z
  .object({
    runId: z.string().min(1).max(160),
    agentRole: AgentRoleSchema,
    toolName: z.string().min(1).max(80),
    command: z.string().max(20_000).nullable(),
    path: z.string().max(1000).nullable(),
    allowedPaths: z.array(z.string().min(1).max(512)).max(200),
    approvedDependencyChange: z.boolean(),
  })
  .strict();

export const ToolPolicyDecisionSchema = z
  .object({
    schemaVersion: z.literal(1),
    runId: z.string().min(1).max(160),
    agentRole: AgentRoleSchema,
    decision: z.enum(["allow", "ask", "deny"]),
    actionClass: z.enum([
      "inspection",
      "source-mutation",
      "scope-escape",
      "secret-access",
      "dependency-mutation",
      "git-history-rewrite",
      "git-publication",
      "pr-mutation",
      "workflow-dispatch",
      "direct-deploy",
      "destructive-operation",
      "unknown",
    ]),
    reason: z.string().min(1).max(500),
    requestFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export type ToolPolicyRequest = z.infer<typeof ToolPolicyRequestSchema>;
export type ToolPolicyDecision = z.infer<typeof ToolPolicyDecisionSchema>;
