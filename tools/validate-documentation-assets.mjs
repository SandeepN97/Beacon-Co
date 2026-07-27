import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const toolsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(toolsDirectory, "..");
const fromRoot = (...segments) => join(projectRoot, ...segments);

const readText = (...segments) =>
  readFile(fromRoot(...segments), "utf8");
const readJson = async (...segments) =>
  JSON.parse(await readText(...segments));
const sha256 = (buffer) =>
  createHash("sha256").update(buffer).digest("hex");

const extractJsonArray = (source, variableName) => {
  const match = source.match(
    new RegExp(`const ${variableName}\\s*=\\s*(\\[[\\s\\S]*?\\]);`),
  );
  assert(match, `Missing ${variableName} array in the proposal`);
  return JSON.parse(match[1]);
};

const validateHandbookArchitecture = async () => {
  const diagramDirectory = ["docs", "assets", "architecture"];
  const scene = await readJson(
    ...diagramDirectory,
    "beacon-system.excalidraw",
  );
  const animatedSvg = await readText(
    ...diagramDirectory,
    "beacon-system-animated.svg",
  );
  const staticSvg = await readText(
    ...diagramDirectory,
    "beacon-system-static.svg",
  );
  const mermaidSource = await readText(
    "docs",
    "diagrams",
    "system-architecture.mmd",
  );

  assert.equal(scene.type, "excalidraw");
  assert.equal(scene.version, 2);
  assert.equal(scene.elements.length, 26);
  assert(
    scene.elements.every((element) =>
      element.id.includes("|animateOrder:")),
    "Every generated architecture element must include animation order",
  );

  const expectedNodes = [
    "PROSPECT",
    "PUBLIC",
    "DATA",
    "QUEUE",
    "WORKERS",
    "APPROVAL",
    "PUBLISH",
    "DASHBOARD",
  ];
  const expectedEdges = [
    "PROSPECT_PUBLIC",
    "PUBLIC_DATA",
    "DATA_QUEUE",
    "QUEUE_WORKERS",
    "WORKERS_APPROVAL",
    "APPROVAL_PUBLISH",
    "DASHBOARD_DATA",
    "DASHBOARD_QUEUE",
  ];
  const sceneIds = new Set(
    scene.elements.map((element) => element.id.split("|")[0]),
  );

  for (const id of [...expectedNodes, ...expectedEdges]) {
    assert(sceneIds.has(id), `Excalidraw scene is missing ${id}`);
  }
  for (const id of expectedNodes) {
    assert(
      mermaidSource.includes(`${id}[`) ||
        mermaidSource.includes(`${id}{`),
      `Mermaid source is missing node ${id}`,
    );
  }
  for (const [from, to] of [
    ["PROSPECT", "PUBLIC"],
    ["PUBLIC", "DATA"],
    ["DATA", "QUEUE"],
    ["QUEUE", "WORKERS"],
    ["WORKERS", "APPROVAL"],
    ["APPROVAL", "PUBLISH"],
    ["DASHBOARD", "DATA"],
    ["DASHBOARD", "QUEUE"],
  ]) {
    const relationship = new RegExp(
      `${from}\\s+(?:<)?[-.]+[^\\n]*?>\\s+${to}`,
    );
    assert(
      relationship.test(mermaidSource),
      `Mermaid source is missing ${from} to ${to}`,
    );
  }

  for (const svg of [animatedSvg, staticSvg]) {
    assert(svg.startsWith("<svg"));
    assert(svg.includes("<title id=\"diagram-title\">"));
    assert(svg.includes("<desc id=\"diagram-description\">"));
    assert(svg.includes("role=\"img\""));
  }
  const animationCount = (animatedSvg.match(/<animate\b/g) || []).length;
  assert(animationCount > 0, "Animated architecture SVG has no animation");
  const animationTimings = [
    ...animatedSvg.matchAll(
      /<animate\b[^>]*\bbegin="([0-9.]+)ms"[^>]*\bdur="([0-9.]+)ms"/g,
    ),
  ].map((match) => ({
    begin: Number.parseFloat(match[1]),
    duration: Number.parseFloat(match[2]),
  }));
  assert.equal(animationTimings.length, animationCount);
  const animationDurationMs = Math.max(
    ...animationTimings.map(
      ({ begin, duration }) => begin + duration,
    ),
  );
  assert(
    animationDurationMs > 0 && animationDurationMs <= 6000,
    "Animated architecture sequence must complete within six seconds",
  );
  assert.equal(
    (staticSvg.match(/<animate\b/g) || []).length,
    0,
    "Reduced-motion SVG must remain static",
  );

  return {
    animationCount,
    animationDurationMs,
    mermaidSources: [mermaidSource],
  };
};

const validateProposalAndIntakePackage = async () => {
  const base = ["docs", "assets", "adr-intake", "ai-company"];
  const proposal = await readText(
    ...base,
    "beacon-and-co-full-business-proposal.html",
  );
  const proposalDom = new JSDOM(proposal);
  const document = proposalDom.window.document;
  const expectedSectionIds = [
    "market",
    "pipeline",
    "intel",
    "services",
    "machine",
    "stack",
    "automate",
    "attention",
    "agentic",
    "model",
    "econ",
    "retain",
    "road",
    "risk",
  ];

  assert.equal(document.querySelectorAll("section").length, 14);
  assert.equal(document.querySelectorAll("table").length, 4);
  assert.equal(document.querySelectorAll("svg").length, 8);
  assert.equal(document.querySelectorAll("script").length, 2);
  for (const id of expectedSectionIds) {
    assert(document.getElementById(id), `Proposal is missing #${id}`);
  }

  const legacyWorkingName = ["ves", "lyn"].join("");
  assert(
    !proposal.toLowerCase().includes(legacyWorkingName),
    "The previous working name remains in the renamed proposal",
  );
  assert(
    proposal.includes("../../vendor/mermaid.min.js"),
    "Proposal must use the locally pinned Mermaid runtime",
  );

  const architectureMermaid = extractJsonArray(proposal, "MMD_SRC");
  const agentWorkflowMermaid = extractJsonArray(proposal, "AGENTIC_MMD");
  assert.equal(architectureMermaid.length, 3);
  assert.equal(agentWorkflowMermaid.length, 2);
  const proposalMermaid = [
    ...architectureMermaid,
    ...agentWorkflowMermaid,
  ];
  const extractedMermaidFiles = [
    "business-flow.mmd",
    "full-system-architecture.mmd",
    "end-to-end-sequence.mmd",
    "provider-failover.mmd",
    "twelve-stage-agent-workflow.mmd",
  ];
  const extractedSvgFiles = [
    "business-loop.svg",
    "platform-architecture-sketch.svg",
    "lead-sequence-sketch.svg",
    "full-system-map.svg",
    "content-media-pipeline.svg",
    "website-motion-pipeline.svg",
    "attention-before.svg",
    "attention-after.svg",
  ];

  for (const [index, file] of extractedMermaidFiles.entries()) {
    const extracted = await readText(
      "docs",
      "diagrams",
      "proposal",
      file,
    );
    assert.equal(
      extracted.trim(),
      proposalMermaid[index].trim(),
      `${file} has drifted from the preserved proposal`,
    );
  }

  for (const file of extractedSvgFiles) {
    const extracted = await readText(
      "docs",
      "assets",
      "architecture",
      "proposal",
      file,
    );
    const extractedDom = new JSDOM(extracted, {
      contentType: "image/svg+xml",
    });
    const svg = extractedDom.window.document.documentElement;
    assert.equal(svg.localName, "svg");
    assert.equal(svg.getAttribute("role"), "img");
    assert(
      svg.querySelector("title")?.textContent.trim(),
      `${file} needs a source title`,
    );
    assert(
      svg.querySelector("path, rect, circle, line, polyline, polygon, text"),
      `${file} contains no visual primitives`,
    );
    extractedDom.window.close();
  }

  const sourceManifest = await readJson(
    "docs",
    "assets",
    "architecture",
    "proposal",
    "source-manifest.json",
  );
  assert.equal(sourceManifest.mermaid.length, 5);
  assert.equal(sourceManifest.svg.length, 8);
  assert.equal(
    sourceManifest.generatedFrom,
    "docs/assets/adr-intake/ai-company/beacon-and-co-full-business-proposal.html",
  );

  const canvasPath = fromRoot(
    ...base,
    "ai_company_all_agents_and_combined_canvas.excalidraw",
  );
  const libraryPath = fromRoot(
    ...base,
    "ai_company_all_agents_and_combined.excalidrawlib",
  );
  const contactSheetPath = fromRoot(
    ...base,
    "ai_company_all_agents_contact_sheet.png",
  );
  const canvasBuffer = await readFile(canvasPath);
  const libraryBuffer = await readFile(libraryPath);
  const contactSheet = await readFile(contactSheetPath);
  const canvas = JSON.parse(canvasBuffer);
  const library = JSON.parse(libraryBuffer);

  assert.equal(canvas.type, "excalidraw");
  assert.equal(canvas.version, 2);
  assert.equal(canvas.source, "https://dai-shi.github.io/excalidraw-animate/");
  assert.equal(canvas.elements.length, 840);
  assert.equal(library.type, "excalidrawlib");
  assert.equal(library.version, 2);
  assert.equal(
    library.source,
    "https://dai-shi.github.io/excalidraw-animate/",
  );
  assert.equal(library.libraryItems.length, 16);
  assert(
    library.libraryItems.every(
      (item) =>
        item.status === "published" &&
        item.name &&
        item.elements.length > 0,
    ),
    "Every Excalidraw library item must be named, published, and non-empty",
  );

  assert.equal(contactSheet.toString("ascii", 1, 4), "PNG");
  assert.equal(contactSheet.readUInt32BE(16), 1410);
  assert.equal(contactSheet.readUInt32BE(20), 910);

  const expectedHashes = new Map([
    [
      "canvas",
      "7ad837f98313862358088bb4d48529460225c0174919421c2f081458ae814357",
    ],
    [
      "library",
      "336a9418cb1437c941f9f0a9cf848c830047b1f3f435bc21d2f9076586be7d94",
    ],
    [
      "contact sheet",
      "ccc4390bee9441c750322b995412fdcb7f6bb8043f062c864dc83ff99e8224db",
    ],
    [
      "proposal",
      "12f2d05b04358ec34f0a286d03473e477d98e85dd74603db965b0298aefb2383",
    ],
  ]);
  assert.equal(sha256(canvasBuffer), expectedHashes.get("canvas"));
  assert.equal(sha256(libraryBuffer), expectedHashes.get("library"));
  assert.equal(sha256(contactSheet), expectedHashes.get("contact sheet"));
  assert.equal(
    sha256(Buffer.from(proposal)),
    expectedHashes.get("proposal"),
  );

  proposalDom.window.close();
  return {
    mermaidSources: [
      ...architectureMermaid,
      ...agentWorkflowMermaid,
    ],
    extractedMermaidSources: extractedMermaidFiles.length,
    extractedSvgs: extractedSvgFiles.length,
    proposalSections: expectedSectionIds.length,
    proposalSvgs: 8,
    libraryItems: library.libraryItems.length,
    canvasElements: canvas.elements.length,
  };
};

const validateMermaidSyntax = async (sources) => {
  const runtime = await readText(
    "docs",
    "assets",
    "vendor",
    "mermaid.min.js",
  );
  const dom = new JSDOM(
    "<!doctype html><html><body></body></html>",
    { pretendToBeVisual: true, runScripts: "dangerously" },
  );
  dom.window.eval(runtime);
  const mermaid = dom.window.mermaid?.default;
  assert(mermaid, "Local Mermaid browser runtime did not initialize");
  mermaid.initialize({ securityLevel: "loose", startOnLoad: false });

  for (const [index, source] of sources.entries()) {
    await mermaid.parse(source);
    assert(source.trim(), `Mermaid source ${index + 1} is empty`);
  }
  dom.window.close();
};

const handbook = await validateHandbookArchitecture();
const intake = await validateProposalAndIntakePackage();
const allMermaidSources = [
  ...handbook.mermaidSources,
  ...intake.mermaidSources,
];
await validateMermaidSyntax(allMermaidSources);

console.log(
  [
    "Documentation assets validated:",
    `${allMermaidSources.length} Mermaid sources parse`,
    `${handbook.animationCount} Excalidraw animation elements in ${
      handbook.animationDurationMs / 1000
    }s`,
    `${intake.proposalSections} proposal sections`,
    `${intake.proposalSvgs} proposal SVG diagrams`,
    `${intake.extractedMermaidSources} extracted Mermaid sources match`,
    `${intake.extractedSvgs} extracted SVG sources parse`,
    `${intake.libraryItems} Excalidraw library diagrams`,
    `${intake.canvasElements} imported canvas elements`,
  ].join(" "),
);
