import { readFile } from "node:fs/promises";

const eventPath = process.env.GITHUB_EVENT_PATH;
if (!eventPath) {
  console.log(
    "GITHUB_EVENT_PATH is not set; PR metadata policy is skipped outside GitHub Actions.",
  );
  process.exit(0);
}

const event = JSON.parse(await readFile(eventPath, "utf8"));
const pullRequest = event.pull_request;
if (!pullRequest) {
  console.log("Event is not a pull request; PR metadata policy is not applicable.");
  process.exit(0);
}

const errors = [];
const title = String(pullRequest.title ?? "").trim();
const body = String(pullRequest.body ?? "");

if (title.length < 8) errors.push("PR title must be at least 8 characters.");
for (const heading of [
  "## Summary",
  "## Risk",
  "## Test evidence",
  "## Documentation impact",
  "## Rollback",
]) {
  if (!body.includes(heading)) errors.push(`PR body is missing ${heading}.`);
}
if (pullRequest.head?.repo?.fork && event.pull_request?.base?.repo?.private) {
  errors.push("Fork PRs into a private repository require an explicit security review.");
}

if (errors.length) {
  console.error("PR policy failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("PR metadata policy passed.");
