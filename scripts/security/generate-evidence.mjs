import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const files = ["package-lock.json", "dist/_worker.js/index.js"];
const artifacts = [];
for (const path of files) {
  try {
    const buffer = await readFile(path);
    artifacts.push({ path, bytes: buffer.byteLength, sha256: sha256(buffer) });
  } catch {
    // Evidence records only artifacts that exist in the current job.
  }
}

const evidence = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  node: process.version,
  artifacts,
  note: "Contains hashes and command metadata only. Secrets, request bodies, and PII are excluded.",
};

await mkdir("evidence", { recursive: true });
await writeFile("evidence/build-evidence.json", `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`Wrote evidence/build-evidence.json with ${artifacts.length} artifact hash(es).`);
