export const REQUIRED_PR_HEADINGS = [
  "## Summary",
  "## Risk",
  "## Test evidence",
  "## Documentation impact",
  "## Rollback",
] as const;

export interface PullRequestPolicyInput {
  title: string;
  body: string;
  headIsFork?: boolean;
  baseRepositoryPrivate?: boolean;
}

export interface PullRequestPolicyDecision {
  valid: boolean;
  errors: string[];
}

export function validatePullRequestPolicy(
  input: PullRequestPolicyInput,
): PullRequestPolicyDecision {
  const errors: string[] = [];
  const title = input.title.trim();
  if (title.length < 8 || title.length > 120) {
    errors.push("PR title must be between 8 and 120 characters.");
  }
  if (title && !/^[A-Z0-9]/.test(title)) {
    errors.push("PR title must start with an uppercase letter or number.");
  }

  let previousIndex = -1;
  for (const heading of REQUIRED_PR_HEADINGS) {
    const matches = [
      ...input.body.matchAll(
        new RegExp(`^${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "gm"),
      ),
    ];
    if (matches.length !== 1) {
      errors.push(`PR body must contain exactly one ${heading} heading.`);
      continue;
    }
    const index = matches[0].index ?? -1;
    if (index <= previousIndex) errors.push(`PR heading is out of order: ${heading}.`);
    previousIndex = index;
  }

  for (let index = 0; index < REQUIRED_PR_HEADINGS.length; index += 1) {
    const heading = REQUIRED_PR_HEADINGS[index];
    const start = input.body.indexOf(heading);
    if (start === -1) continue;
    const contentStart = start + heading.length;
    const nextHeading = REQUIRED_PR_HEADINGS[index + 1];
    const end = nextHeading ? input.body.indexOf(nextHeading, contentStart) : input.body.length;
    const content = input.body.slice(contentStart, end === -1 ? input.body.length : end).trim();
    if (!content || /<!--|\b(?:TBD|TODO)\b|<PROVIDE_/i.test(content)) {
      errors.push(`PR body section ${heading} must contain resolved content.`);
    }
  }

  if (input.headIsFork && input.baseRepositoryPrivate) {
    errors.push("Fork PRs into a private repository require an explicit security review.");
  }
  return { valid: errors.length === 0, errors };
}
