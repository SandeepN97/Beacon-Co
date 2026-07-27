import { createHash } from "node:crypto";
import { access, copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const downloadsDirectory = join(homedir(), "Downloads");
const materialsRoot = join(projectRoot, "reference", "source-materials");
const originalsDirectory = join(materialsRoot, "originals");
const extractedDirectory = join(materialsRoot, "extracted");
const inventoryDirectory = join(materialsRoot, "inventory");
const publicDiagramDirectory = join(projectRoot, "public", "diagrams", "source");

const sourceRules = [
  {
    pattern: /^Claude_Multi_Agent_Business_Guide.*\.pdf$/i,
    tier: "tier-1",
    note: "Authoritative multi-agent business guide",
  },
  {
    pattern: /^Claude_Codex_Broker_Addendum.*\.docx$/i,
    tier: "tier-1",
    note: "Authoritative Claude/Codex broker addendum",
  },
  {
    pattern: /^ai_company_all_agents_and_combined_canvas.*\.excalidraw$/i,
    tier: "tier-1",
    note: "Authoritative combined agent architecture canvas",
  },
  {
    pattern: /^ai_company_all_agents_one_file_package.*\.zip$/i,
    tier: "tier-1",
    note: "Authoritative all-agents package",
  },
  {
    pattern: /^easy_read_ai_company_architecture.*\.excalidraw$/i,
    tier: "tier-1",
    note: "Authoritative easy-read company architecture",
  },
  {
    pattern: /^individual_agent_architecture_animated.*\.excalidraw$/i,
    tier: "tier-1",
    note: "Authoritative individual-agent architecture",
  },
  {
    pattern: /^multi_agent_business_broker_excalidraw_package.*\.zip$/i,
    tier: "tier-1",
    note: "Authoritative broker architecture package",
  },
  {
    pattern: /^unified_agent_operating_architecture_all_in_one.*\.excalidraw$/i,
    tier: "tier-1",
    note: "Authoritative unified operating architecture",
  },
  {
    pattern: /^BEACON_COMPLETE_EXECUTION_PROMPT.*\.md$/i,
    tier: "tier-1",
    note: "Authoritative execution requirements",
  },
  {
    pattern: /^BEACON_SECURE_CICD_ARCHITECTURE_10_OF_10\.excalidraw$/i,
    tier: "tier-1",
    note: "Target secure CI/CD and AI delivery architecture",
  },
  {
    pattern: /^BEACON_SECURE_CICD_EXECUTION_PROMPT_10_OF_10\.md$/i,
    tier: "tier-1",
    note: "Authoritative secure CI/CD execution requirements",
  },
  {
    pattern: /^BEACON_SECURE_CICD_IMPLEMENTATION_PLAN_10_OF_10\.md$/i,
    tier: "tier-1",
    note: "Authoritative secure CI/CD target implementation plan",
  },
  {
    pattern: /^smart-home-architecture.*\.html$/i,
    tier: "tier-3",
    note: "Visual and interaction reference only",
  },
  {
    pattern: /^v9-source.*\.html$/i,
    tier: "tier-3",
    note: "Visual and interaction reference only",
  },
  {
    pattern: /^veslyn-proposal.*\.html$/i,
    tier: "tier-3",
    note: "Visual and interaction reference only; legacy name",
  },
];

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

const exists = async (path) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const writeWhenChanged = async (path, content) => {
  if (await exists(path)) {
    const current = await readFile(path, "utf8");
    if (current === content) return false;
  }
  await writeFile(path, content);
  return true;
};

const collisionPath = (fileName, hash) => {
  const extension = extname(fileName);
  const stem = fileName.slice(0, fileName.length - extension.length);
  return join(originalsDirectory, `${stem}__${hash.slice(0, 12)}${extension}`);
};

const extractionStatus = async (fileName) => {
  if (/^Claude_Multi_Agent_Business_Guide.*\.pdf$/i.test(fileName)) {
    return (await exists(join(extractedDirectory, "Claude_Multi_Agent_Business_Guide.txt")))
      ? "copied-and-text-extracted"
      : "copied-awaiting-text-extraction";
  }
  if (/^Claude_Codex_Broker_Addendum.*\.docx$/i.test(fileName)) {
    return (await exists(join(extractedDirectory, "Claude_Codex_Broker_Addendum.txt")))
      ? "copied-and-text-extracted"
      : "copied-awaiting-text-extraction";
  }
  if (/^ai_company_all_agents_one_file_package.*\.zip$/i.test(fileName)) {
    return (await exists(join(extractedDirectory, "ai-company-package")))
      ? "copied-and-extracted"
      : "copied-awaiting-extraction";
  }
  if (/^multi_agent_business_broker_excalidraw_package.*\.zip$/i.test(fileName)) {
    return (await exists(join(extractedDirectory, "broker-package")))
      ? "copied-and-extracted"
      : "copied-awaiting-extraction";
  }
  if (/\.excalidraw$/i.test(fileName)) return "copied-and-structurally-inspected";
  if (/\.html$/i.test(fileName)) return "copied-and-visually-inspected";
  if (/\.md$/i.test(fileName)) return "copied-and-read";
  return "copied";
};

await access(downloadsDirectory);
await Promise.all([
  mkdir(originalsDirectory, { recursive: true }),
  mkdir(join(materialsRoot, "extracted"), { recursive: true }),
  mkdir(join(materialsRoot, "generated-previews"), {
    recursive: true,
  }),
  mkdir(inventoryDirectory, { recursive: true }),
  mkdir(publicDiagramDirectory, { recursive: true }),
]);

const downloadsEntries = await readdir(downloadsDirectory, {
  withFileTypes: true,
});
const selectedSources = downloadsEntries
  .filter((entry) => entry.isFile())
  .map((entry) => {
    const rule = sourceRules.find(({ pattern }) => pattern.test(entry.name));
    return rule ? { fileName: entry.name, rule } : null;
  })
  .filter(Boolean)
  .sort((left, right) => left.fileName.localeCompare(right.fileName));

const inventory = [];
for (const { fileName, rule } of selectedSources) {
  const sourcePath = join(downloadsDirectory, fileName);
  const sourceBuffer = await readFile(sourcePath);
  const sourceHash = sha256(sourceBuffer);
  const sourceStat = await stat(sourcePath);
  let destinationPath = join(originalsDirectory, fileName);
  let note = rule.note;

  if (await exists(destinationPath)) {
    const destinationHash = sha256(await readFile(destinationPath));
    if (destinationHash === sourceHash) {
      note = `${note}; identical repository copy already present`;
    } else {
      destinationPath = collisionPath(fileName, sourceHash);
      note = `${note}; filename collision preserved with hash suffix`;
      if (!(await exists(destinationPath))) {
        await copyFile(sourcePath, destinationPath);
      }
    }
  } else {
    await copyFile(sourcePath, destinationPath);
  }

  if (/^BEACON_SECURE_CICD_ARCHITECTURE_10_OF_10\.excalidraw$/i.test(fileName)) {
    const publicPath = join(publicDiagramDirectory, fileName);
    if (!(await exists(publicPath)) || sha256(await readFile(publicPath)) !== sourceHash) {
      await copyFile(sourcePath, publicPath);
    }
  }

  inventory.push({
    originalPath: `~/Downloads/${fileName}`,
    repositoryPath: relative(projectRoot, destinationPath),
    filename: basename(destinationPath),
    originalFilename: fileName,
    extension: extname(fileName).toLowerCase(),
    byteSize: sourceStat.size,
    modificationTime: sourceStat.mtime.toISOString(),
    sha256: sourceHash,
    authorityTier: rule.tier,
    extractionStatus: await extractionStatus(fileName),
    notes: note,
  });
}

const inventoryDocument = {
  schemaVersion: 1,
  sourceRoot: "~/Downloads",
  repositoryRoot: "reference/source-materials",
  sourceCount: inventory.length,
  sources: inventory,
};
const jsonContent = `${JSON.stringify(inventoryDocument, null, 2)}\n`;

const markdownRows = inventory
  .map(
    (source) =>
      `| \`${source.originalFilename}\` | ${source.authorityTier} | ${source.byteSize} | \`${source.sha256}\` | \`${source.repositoryPath}\` | ${source.extractionStatus} |`,
  )
  .join("\n");
const markdownContent = `# Source material inventory

This inventory is generated by \`scripts/import-reference-materials.mjs\`.
The import is non-destructive: originals remain in \`~/Downloads\`.

| Source | Authority | Bytes | SHA-256 | Repository copy | Status |
|---|---|---:|---|---|---|
${markdownRows}

## Authority

- **tier-1** — authoritative Beacon organization, architecture, broker, or execution content.
- **tier-2** — current repository implementation and constraints; inventoried separately through Git.
- **tier-3** — visual and interaction reference only.

## Collision behavior

Identical files are not duplicated. Different files sharing a name are preserved with a short content-hash suffix.
`;

const jsonChanged = await writeWhenChanged(
  join(inventoryDirectory, "source-inventory.json"),
  jsonContent,
);
const markdownChanged = await writeWhenChanged(
  join(inventoryDirectory, "source-inventory.md"),
  markdownContent,
);

console.log(
  [
    `Imported ${inventory.length} source materials.`,
    jsonChanged || markdownChanged ? "Inventory updated." : "Inventory unchanged.",
    "Downloads originals were not modified.",
  ].join(" "),
);
