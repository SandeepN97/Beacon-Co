import { readFile, readdir } from "node:fs/promises";
import { parse } from "yaml";

const approved = parse(await readFile("security/approved-actions.yml", "utf8")).actions;
const approvedByUse = new Map(
  Object.entries(approved).map(([name, record]) => [`${name}@${record.sha}`, record]),
);
const workflowFiles = (await readdir(".github/workflows"))
  .filter((name) => /\.ya?ml$/.test(name))
  .sort();
const errors = [];

const visitSteps = (steps, file, jobName) => {
  for (const step of steps ?? []) {
    if (!step.uses) continue;
    if (step.uses.startsWith("./")) continue;
    const [name, sha] = step.uses.split("@");
    if (!/^[a-f0-9]{40}$/.test(sha ?? "")) {
      errors.push(`${file}/${jobName}: ${step.uses} is not pinned to a full commit SHA.`);
      continue;
    }
    if (!approvedByUse.has(`${name}@${sha}`)) {
      errors.push(`${file}/${jobName}: ${step.uses} is not in security/approved-actions.yml.`);
    }
  }
};

for (const file of workflowFiles) {
  const source = await readFile(`.github/workflows/${file}`, "utf8");
  const workflow = parse(source);
  if (!workflow || typeof workflow !== "object") {
    errors.push(`${file}: invalid YAML document.`);
    continue;
  }
  if (!workflow.permissions || Object.keys(workflow.permissions).length !== 0) {
    errors.push(`${file}: top-level permissions must be {}.`);
  }
  if ("pull_request_target" in (workflow.on ?? {})) {
    errors.push(`${file}: pull_request_target is prohibited.`);
  }
  for (const [jobName, job] of Object.entries(workflow.jobs ?? {})) {
    if (!job["timeout-minutes"]) errors.push(`${file}/${jobName}: timeout-minutes is required.`);
    if (!job.permissions) errors.push(`${file}/${jobName}: explicit job permissions are required.`);
    visitSteps(job.steps, file, jobName);
  }
  for (const line of source.split(/\r?\n/)) {
    if (/^\s*uses:\s*[^#\n]+@[^\s#]+\s*$/.test(line)) {
      errors.push(`${file}: action use must include a reviewed release comment.`);
    }
  }
}

if (errors.length) {
  console.error(`Workflow policy failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Validated ${workflowFiles.length} workflow definitions and action pins.`);
