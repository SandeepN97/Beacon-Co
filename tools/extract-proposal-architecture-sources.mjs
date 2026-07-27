import { JSDOM } from "jsdom";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const toolsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(toolsDirectory, "..");
const proposalPath = join(
  projectRoot,
  "docs",
  "assets",
  "adr-intake",
  "ai-company",
  "beacon-and-co-full-business-proposal.html",
);
const diagramDirectory = join(
  projectRoot,
  "docs",
  "diagrams",
  "proposal",
);
const visualDirectory = join(
  projectRoot,
  "docs",
  "assets",
  "architecture",
  "proposal",
);

const proposal = await readFile(proposalPath, "utf8");
const dom = new JSDOM(proposal);
const document = dom.window.document;

const extractJsonArray = (variableName) => {
  const match = proposal.match(
    new RegExp(`const ${variableName}\\s*=\\s*(\\[[\\s\\S]*?\\]);`),
  );
  if (!match) {
    throw new Error(`Missing ${variableName} in proposal`);
  }
  return JSON.parse(match[1]);
};

const mermaidSources = [
  ...extractJsonArray("MMD_SRC"),
  ...extractJsonArray("AGENTIC_MMD"),
];
const mermaidFiles = [
  "business-flow.mmd",
  "full-system-architecture.mmd",
  "end-to-end-sequence.mmd",
  "provider-failover.mmd",
  "twelve-stage-agent-workflow.mmd",
];
const visualFiles = [
  "business-loop.svg",
  "platform-architecture-sketch.svg",
  "lead-sequence-sketch.svg",
  "full-system-map.svg",
  "content-media-pipeline.svg",
  "website-motion-pipeline.svg",
  "attention-before.svg",
  "attention-after.svg",
];
const visualTitles = [
  "Beacon & Co. business loop",
  "Beacon & Co. proposed platform architecture",
  "Lead-to-renewal sequence",
  "Full proposed system map",
  "Content and media pipeline",
  "Website motion pipeline",
  "Competing-attention example",
  "Single-CTA attention example",
];
const standaloneSvgStyle = `
  :root {
    --forest: #2a4228;
    --cream: #fdfcf8;
    --ink: #1a1712;
    --ink2: #5a5548;
    --red: #a03d2e;
  }
  svg { background: var(--cream); }
  text {
    fill: var(--ink);
    font-family: "DM Sans", Arial, sans-serif;
  }
  .sketch .st {
    fill: none;
    stroke: var(--ink);
    stroke-dasharray: none !important;
    stroke-dashoffset: 0 !important;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2.2;
  }
  .sketch .st.green { stroke: var(--forest); }
  .sketch .st.gold { stroke: #a8842e; }
  .sketch .st.red { stroke: var(--red); }
  .sketch .st.sage { stroke: #4a6640; }
  .sketch .st.purple { stroke: #7c5e99; }
  .sketch .st.blue { stroke: #3d6a8a; }
  .sketch .st.dash { stroke-dasharray: 6 5 !important; }
  .sketch .t-big { font-size: 23px; font-weight: 700; }
  .sketch .t-md { font-size: 17px; font-weight: 600; }
  .sketch .t-sm { fill: var(--ink2); font-size: 13.5px; }
  .sketch .t-green { fill: var(--forest); }
  .sketch .t-gold { fill: #a8842e; }
  .sketch .t-red { fill: var(--red); }
`;

await Promise.all([
  mkdir(diagramDirectory, { recursive: true }),
  mkdir(visualDirectory, { recursive: true }),
]);

await Promise.all(
  mermaidSources.map((source, index) =>
    writeFile(
      join(diagramDirectory, mermaidFiles[index]),
      `${source.trim()}\n`,
    ),
  ),
);

const inlineSvgs = [...document.querySelectorAll("svg")];
if (inlineSvgs.length !== visualFiles.length) {
  throw new Error(
    `Expected ${visualFiles.length} proposal SVGs; found ${inlineSvgs.length}`,
  );
}

await Promise.all(
  inlineSvgs.map((sourceSvg, index) => {
    const svg = sourceSvg.cloneNode(true);
    svg.removeAttribute("style");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-labelledby", `title-${index + 1}`);

    const title = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "title",
    );
    title.id = `title-${index + 1}`;
    title.textContent = visualTitles[index];

    const style = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "style",
    );
    style.textContent = standaloneSvgStyle;
    svg.prepend(style);
    svg.prepend(title);

    return writeFile(
      join(visualDirectory, visualFiles[index]),
      `${svg.outerHTML}\n`,
    );
  }),
);

const manifest = {
  generatedFrom:
    "docs/assets/adr-intake/ai-company/beacon-and-co-full-business-proposal.html",
  generatedAtBuildTime: true,
  mermaid: mermaidFiles.map((file, index) => ({
    file: `docs/diagrams/proposal/${file}`,
    title: [
      "Business flow",
      "Full system architecture",
      "End-to-end sequence",
      "Claude/Codex provider failover",
      "Twelve-stage agent workflow",
    ][index],
  })),
  svg: visualFiles.map((file, index) => ({
    file: `docs/assets/architecture/proposal/${file}`,
    title: visualTitles[index],
  })),
};
await writeFile(
  join(visualDirectory, "source-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

dom.window.close();
console.log(
  `Extracted ${mermaidFiles.length} Mermaid sources and ${visualFiles.length} SVG sources from the proposal`,
);
