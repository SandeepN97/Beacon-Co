export type ChangedPathCategory = "agent" | "ci-security" | "documentation" | "ui" | "other";

export interface ChangedPathClassification {
  paths: string[];
  categories: ChangedPathCategory[];
  developmentChecks: string[];
}

const startsWithAny = (path: string, prefixes: string[]) =>
  prefixes.some((prefix) => path === prefix || path.startsWith(prefix));

export function classifyChangedPaths(paths: string[]): ChangedPathClassification {
  const categories = new Set<ChangedPathCategory>();
  for (const path of paths) {
    if (
      startsWithAny(path, [
        "agent-platform/",
        "scripts/agents/",
        "src/modules/orchestration/",
        "tests/agents/",
        "tests/orchestration/",
      ])
    )
      categories.add("agent");
    if (
      startsWithAny(path, [
        ".github/",
        "scripts/ci/",
        "scripts/security/",
        "security/",
        "package.json",
        "package-lock.json",
      ])
    )
      categories.add("ci-security");
    if (
      startsWithAny(path, [
        "src/content/docs/",
        "src/components/docs/",
        "public/diagrams/",
        "tests/browser/diagrams.spec.ts",
      ])
    )
      categories.add("documentation");
    if (
      startsWithAny(path, [
        "src/components/",
        "src/layouts/",
        "src/pages/",
        "src/styles/",
        "tests/browser/",
        "playwright.config.ts",
      ])
    )
      categories.add("ui");
  }
  if (categories.size === 0) categories.add("other");

  const checks = new Set(["formatting", "lint", "typecheck", "unit"]);
  if (categories.has("agent")) {
    for (const check of [
      "agent-contracts",
      "telemetry-schemas",
      "deterministic-agent-evals",
      "model-policy",
      "security-policy",
    ])
      checks.add(check);
  }
  if (categories.has("ci-security")) {
    checks.add("workflow-action-pins");
    checks.add("security-policy");
  }
  if (categories.has("documentation")) {
    checks.add("documentation-validation");
    checks.add("built-links");
    checks.add("diagram-rendering");
  }
  if (categories.has("ui")) {
    for (const check of ["browser-smoke", "accessibility", "responsive", "reduced-motion"])
      checks.add(check);
  }
  return {
    paths: [...new Set(paths)].sort(),
    categories: [...categories].sort(),
    developmentChecks: [...checks].sort(),
  };
}
