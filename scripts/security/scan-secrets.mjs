import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const candidatePatterns = [
  {
    name: "private key",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    name: "GitHub token",
    pattern: /\b(?:ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{20,}\b/,
  },
  {
    name: "Cloudflare API token",
    pattern: /\b[A-Za-z0-9_-]{40}\b/,
    pathPattern: /(?:\.env|secret|credential|wrangler)/i,
  },
  {
    name: "generic assigned secret",
    pattern: /\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*["'][A-Za-z0-9/+_.=-]{16,}["']/i,
  },
];

const allowlistedPaths = new Set([
  "scripts/security/scan-secrets.mjs",
  "src/content/docs/security/secrets-management.mdoc",
]);
const files = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], {
  encoding: "utf8",
})
  .split(/\r?\n/)
  .filter(Boolean)
  .filter(
    (path) =>
      !path.startsWith("reference/") &&
      !path.startsWith("public/vendor/") &&
      !path.endsWith(".excalidraw") &&
      !path.endsWith(".png") &&
      !path.endsWith(".pdf") &&
      !path.endsWith(".zip") &&
      path !== "package-lock.json",
  );

const findings = [];
for (const path of files) {
  if (allowlistedPaths.has(path)) continue;
  let source;
  try {
    source = await readFile(path, "utf8");
  } catch {
    continue;
  }
  for (const candidate of candidatePatterns) {
    if (candidate.pathPattern && !candidate.pathPattern.test(path)) continue;
    if (candidate.pattern.test(source)) findings.push(`${path}: possible ${candidate.name}`);
  }
}

if (findings.length) {
  console.error("Potential secrets detected. Values are intentionally not printed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Secret scan passed for ${files.length} repository files.`);
