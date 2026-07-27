import { readFile } from "node:fs/promises";
import { parse } from "yaml";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const policy = parse(await readFile("security/approved-dependencies.yml", "utf8"));
const approvedProduction = new Set(policy.dependencies.production);
const approvedDevelopment = new Set(policy.dependencies.development);
const errors = [];

for (const dependency of Object.keys(packageJson.dependencies ?? {})) {
  if (!approvedProduction.has(dependency)) {
    errors.push(`Unapproved production dependency: ${dependency}`);
  }
}
for (const dependency of Object.keys(packageJson.devDependencies ?? {})) {
  if (!approvedDevelopment.has(dependency)) {
    errors.push(`Unapproved development dependency: ${dependency}`);
  }
}
for (const dependency of approvedProduction) {
  if (!(dependency in (packageJson.dependencies ?? {}))) {
    errors.push(`Policy lists missing production dependency: ${dependency}`);
  }
}
for (const dependency of approvedDevelopment) {
  if (!(dependency in (packageJson.devDependencies ?? {}))) {
    errors.push(`Policy lists missing development dependency: ${dependency}`);
  }
}

const lockfile = JSON.parse(await readFile("package-lock.json", "utf8"));
if (!lockfile.packages?.[""]) errors.push("package-lock.json has no root package record.");

if (errors.length) {
  console.error("Dependency policy failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Dependency policy passed for ${approvedProduction.size} production and ${approvedDevelopment.size} development dependencies.`,
);
