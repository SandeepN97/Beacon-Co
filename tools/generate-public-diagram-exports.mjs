import { build } from "esbuild";
import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

const toolsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(toolsDirectory, "..");
const sourceDirectory = join(projectRoot, "public", "diagrams", "source");
const exportDirectory = join(projectRoot, "public", "diagrams", "exports");
const runtimePath = join(tmpdir(), `beacon-public-excalidraw-runtime-${process.pid}.mjs`);

const diagrams = [
  {
    id: "beacon-system",
    source: "beacon-system.excalidraw",
    title: "Beacon phased system architecture",
    description:
      "The implemented marketing and contact boundary followed by the gated data, worker, approval, publishing, reporting, and operator phases.",
  },
  {
    id: "ai-company-all-agents",
    source: "ai_company_all_agents_and_combined_canvas.excalidraw",
    title: "AI company and all-agent operating canvas",
    description:
      "The complete company structure, broker flow, work lifecycle, and specialist-agent responsibilities on one supplied canvas.",
  },
  {
    id: "easy-read-ai-company-architecture",
    source: "easy_read_ai_company_architecture.excalidraw",
    title: "Easy-read AI company architecture",
    description:
      "A simplified view of the owner request, company lanes, broker, specialist agents, review, approval, and delivery flow.",
  },
  {
    id: "individual-agent-architecture",
    source: "individual_agent_architecture_animated.excalidraw",
    title: "Individual-agent architecture",
    description:
      "Fourteen specialist roles and the internal seven-step agent pattern used to receive, validate, execute, review, and hand off work.",
  },
  {
    id: "unified-agent-operating-architecture",
    source: "unified_agent_operating_architecture_all_in_one.excalidraw",
    title: "Unified agent operating architecture",
    description:
      "The combined system, company, broker, workflow, and role-level target architecture.",
  },
  {
    id: "multi-agent-broker-end-to-end",
    source: "multi_agent_business_broker_end_to_end.excalidraw",
    title: "Multi-agent broker end-to-end",
    description:
      "The broker control plane from intake and routing through isolated execution, deterministic checks, independent review, approval, and audit.",
  },
  {
    id: "beacon-secure-cicd-architecture",
    source: "BEACON_SECURE_CICD_ARCHITECTURE_10_OF_10.excalidraw",
    title: "Beacon secure CI/CD architecture",
    description:
      "The repository, pull-request, protected-main, artifact-promotion, environment-approval, production-verification, rollback, and evidence boundaries.",
  },
];

const installDomGlobals = () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    pretendToBeVisual: true,
  });
  const globals = [
    "window",
    "document",
    "navigator",
    "DOMParser",
    "XMLSerializer",
    "HTMLElement",
    "HTMLCanvasElement",
    "SVGElement",
    "Element",
    "Node",
    "NodeList",
    "CSSStyleSheet",
    "getComputedStyle",
    "devicePixelRatio",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "Blob",
    "File",
  ];

  globals.forEach((name) => {
    if (dom.window[name]) {
      Object.defineProperty(globalThis, name, {
        configurable: true,
        value: dom.window[name],
        writable: true,
      });
    }
  });

  dom.window.SVGElement.prototype.getBBox = function getBBox() {
    const text = this.textContent || "";
    const fontSize = Number.parseFloat(this.getAttribute("font-size") || "20");
    const width = Math.max(fontSize, text.length * fontSize * 0.56);
    return { x: 0, y: 0, width, height: fontSize * 1.25 };
  };

  dom.window.SVGElement.prototype.getComputedTextLength = function getComputedTextLength() {
    return this.getBBox().width;
  };

  dom.window.Element.prototype.getBoundingClientRect = function getRect() {
    const text = this.textContent || "";
    const fontSize = Number.parseFloat(this.getAttribute?.("font-size") || "20");
    const width = Math.max(fontSize, text.length * fontSize * 0.56);
    const height = fontSize * 1.25;
    return {
      bottom: height,
      height,
      left: 0,
      right: width,
      toJSON: () => ({ x: 0, y: 0, width, height }),
      top: 0,
      width,
      x: 0,
      y: 0,
    };
  };

  dom.window.HTMLCanvasElement.prototype.getContext = () => ({
    filter: "none",
    font: "18px sans-serif",
    measureText: (text) => ({
      actualBoundingBoxAscent: 14,
      actualBoundingBoxDescent: 4,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: String(text).length * 10,
      fontBoundingBoxAscent: 14,
      fontBoundingBoxDescent: 4,
      width: String(text).length * 10,
    }),
    restore: () => {},
    save: () => {},
  });

  class MockFontFace {
    constructor(family, source, descriptors = {}) {
      this.family = family;
      this.source = source;
      Object.assign(this, descriptors);
      this.status = "loaded";
    }

    load() {
      return Promise.resolve(this);
    }
  }

  Object.defineProperty(globalThis, "FontFace", {
    configurable: true,
    value: MockFontFace,
    writable: true,
  });
  Object.defineProperty(dom.window.document, "fonts", {
    configurable: true,
    value: {
      add: () => {},
      check: () => true,
      delete: () => true,
      forEach: () => {},
      ready: Promise.resolve(),
    },
  });

  return dom;
};

const addAccessibilityMetadata = (svg, diagram, variant) => {
  const titleId = `${diagram.id}-${variant}-title`;
  const descriptionId = `${diagram.id}-${variant}-description`;
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-labelledby", `${titleId} ${descriptionId}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  const title = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "title");
  title.setAttribute("id", titleId);
  title.textContent = diagram.title;

  const description = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "desc");
  description.setAttribute("id", descriptionId);
  description.textContent = diagram.description;

  svg.prepend(description);
  svg.prepend(title);
};

const addReducedMotionGuard = (svg) => {
  const style = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent =
    "@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }";
  svg.prepend(style);
};

const sha256 = (source) => createHash("sha256").update(source).digest("hex");

const main = async () => {
  const dom = installDomGlobals();

  await build({
    entryPoints: [join(toolsDirectory, "excalidraw-runtime-entry.mjs")],
    outfile: runtimePath,
    bundle: true,
    platform: "node",
    format: "esm",
    external: ["canvas"],
    logLevel: "silent",
  });

  try {
    const runtime = await import(`${pathToFileURL(runtimePath).href}?v=${Date.now()}`);
    await mkdir(exportDirectory, { recursive: true });

    const manifest = [];
    for (const diagram of diagrams) {
      const sourcePath = join(sourceDirectory, diagram.source);
      const source = await readFile(sourcePath, "utf8");
      const scene = JSON.parse(source);
      const elements = (scene.elements ?? []).filter((element) => !element.isDeleted);
      const appState = {
        ...(scene.appState ?? {}),
        exportBackground: true,
        exportWithDarkMode: false,
        viewBackgroundColor: scene.appState?.viewBackgroundColor || "#fdfcf8",
      };
      const staticSvg = await runtime.exportToSvg({
        elements,
        appState,
        files: scene.files ?? null,
        exportPadding: 28,
        skipInliningFonts: true,
      });
      addAccessibilityMetadata(staticSvg, diagram, "static");

      const staticFile = `${diagram.id}-static.svg`;
      await writeFile(join(exportDirectory, staticFile), `${staticSvg.outerHTML}\n`);

      const hasAnimation = elements.some((element) => element.id?.includes("animateOrder:"));
      let animatedFile = null;
      if (hasAnimation) {
        const animatedSvg = staticSvg.cloneNode(true);
        runtime.animateSvg(animatedSvg, elements, { startMs: 250 });
        addReducedMotionGuard(animatedSvg);
        animatedFile = `${diagram.id}-animated.svg`;
        await writeFile(join(exportDirectory, animatedFile), `${animatedSvg.outerHTML}\n`);
      }

      manifest.push({
        id: diagram.id,
        title: diagram.title,
        description: diagram.description,
        source: `/diagrams/source/${diagram.source}`,
        sourceFile: basename(sourcePath),
        sourceSha256: sha256(source),
        static: `/diagrams/exports/${staticFile}`,
        animated: animatedFile ? `/diagrams/exports/${animatedFile}` : null,
        hasAnimation,
        elementCount: elements.length,
      });

      console.log(
        `Rendered ${diagram.title}: ${elements.length} elements${
          hasAnimation ? " + animation" : ""
        }`,
      );
    }

    await writeFile(
      join(projectRoot, "public", "diagrams", "catalog.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
  } finally {
    dom.window.close();
    await unlink(runtimePath).catch(() => {});
  }
};

await main();
