#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { validatePullRequestPolicy } from "../../src/modules/orchestration/publication/pr-policy.ts";

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? null : process.argv[index + 1];
}

const titleFile = valueAfter("--title-file");
const bodyFile = valueAfter("--body-file");
const explicitEventPath = valueAfter("--event");
const requireContext = process.argv.includes("--require-context");
let policyInput = null;

if (titleFile || bodyFile) {
  if (!titleFile || !bodyFile) {
    console.error("PR policy failed:\n- Both --title-file and --body-file are required.");
    process.exit(1);
  }
  policyInput = {
    title: await readFile(titleFile, "utf8"),
    body: await readFile(bodyFile, "utf8"),
  };
} else {
  const eventPath = explicitEventPath ?? process.env.GITHUB_EVENT_PATH;
  if (eventPath) {
    const event = JSON.parse(await readFile(eventPath, "utf8"));
    const pullRequest = event.pull_request;
    if (pullRequest) {
      policyInput = {
        title: String(pullRequest.title ?? ""),
        body: String(pullRequest.body ?? ""),
        headIsFork: pullRequest.head?.repo?.fork === true,
        baseRepositoryPrivate: pullRequest.base?.repo?.private === true,
      };
    } else if (requireContext) {
      console.error("PR policy failed:\n- The supplied event is not a pull request event.");
      process.exit(1);
    }
  }
}

if (!policyInput) {
  if (requireContext) {
    console.error("PR policy failed:\n- Explicit PR metadata or a pull-request event is required.");
    process.exit(1);
  }
  console.log("PR metadata policy is not applicable outside a publication context.");
  process.exit(0);
}

const decision = validatePullRequestPolicy(policyInput);
if (!decision.valid) {
  console.error("PR policy failed:");
  for (const error of decision.errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("PR metadata policy passed.");
