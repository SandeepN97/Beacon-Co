import { validateProviderRun, type ProviderRun } from "../domain/provider-run.ts";

const REDACTED = "[REDACTED]";
const OMITTED = "[OMITTED]";
const MAX_DEPTH = 5;
const MAX_KEYS = 64;
const MAX_ARRAY_ITEMS = 64;
const MAX_STRING_LENGTH = 512;
const MAX_NODES = 512;

const sensitiveKeyPattern =
  /^(?:authorization|password|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|private[_-]?key|cookie|set-cookie|raw[_-]?prompt|prompt|content|transcript|request[_-]?body|response[_-]?body|env|environment)$/i;
const sensitiveValuePatterns = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(?:ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{20,}\b/,
  /\bBearer\s+[A-Za-z0-9._~+/-]{12,}=*\b/i,
];

function sanitizeString(value: string): string {
  if (sensitiveValuePatterns.some((pattern) => pattern.test(value))) return REDACTED;
  if (value.length <= MAX_STRING_LENGTH) return value;
  return `${value.slice(0, MAX_STRING_LENGTH)}…[TRUNCATED]`;
}

function sanitizeValue(value: unknown, depth: number, budget: { remaining: number }): unknown {
  budget.remaining -= 1;
  if (budget.remaining < 0) return OMITTED;
  if (depth > MAX_DEPTH) return OMITTED;
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : OMITTED;
  if (typeof value === "string") return sanitizeString(value);
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeValue(item, depth + 1, budget));
  }
  if (!value || typeof value !== "object") return OMITTED;

  const sanitized: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value).slice(0, MAX_KEYS)) {
    sanitized[key] = sensitiveKeyPattern.test(key)
      ? REDACTED
      : sanitizeValue(nested, depth + 1, budget);
  }
  return sanitized;
}

export function sanitizeProviderMetadata(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return sanitizeValue(input, 0, { remaining: MAX_NODES }) as Record<string, unknown>;
}

export function prepareProviderRun(input: unknown): ProviderRun {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return validateProviderRun(input);
  }
  const candidate = input as Record<string, unknown>;
  return validateProviderRun({
    ...candidate,
    providerMetadata: sanitizeProviderMetadata(candidate.providerMetadata),
  });
}
