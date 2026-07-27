import { build } from "esbuild";
import { JSDOM } from "jsdom";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const toolsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(toolsDirectory, "..");
const outputDirectory = join(
  projectRoot,
  "docs",
  "assets",
  "architecture",
);
const vendorDirectory = join(projectRoot, "docs", "assets", "vendor");
const mermaidRuntimeEntry = join(
  projectRoot,
  "node_modules",
  "mermaid",
  "dist",
  "mermaid.esm.min.mjs",
);
const runtimePath = join(
  tmpdir(),
  `beacon-excalidraw-runtime-${process.pid}.mjs`,
);

const brand = {
  forest: "#2a4228",
  sage: "#7a9e72",
  gold: "#c49a48",
  cream: "#fdfcf8",
  creamDeep: "#f5f1e7",
  ink: "#1a1712",
};

const animationOrder = {
  PROSPECT: 1,
  PUBLIC: 3,
  DATA: 5,
  QUEUE: 7,
  WORKERS: 9,
  APPROVAL: 11,
  PUBLISH: 13,
  DASHBOARD: 15,
};

const phaseStyles = {
  PROSPECT: {
    backgroundColor: brand.creamDeep,
    strokeColor: brand.gold,
  },
  PUBLIC: {
    backgroundColor: "#dfe9dc",
    strokeColor: brand.forest,
  },
  DATA: {
    backgroundColor: brand.cream,
    strokeColor: brand.sage,
  },
  QUEUE: {
    backgroundColor: brand.cream,
    strokeColor: brand.sage,
  },
  WORKERS: {
    backgroundColor: brand.cream,
    strokeColor: brand.sage,
  },
  APPROVAL: {
    backgroundColor: "#f7edda",
    strokeColor: brand.gold,
  },
  PUBLISH: {
    backgroundColor: "#f7edda",
    strokeColor: brand.gold,
  },
  DASHBOARD: {
    backgroundColor: brand.cream,
    strokeColor: brand.sage,
  },
};

const node = (id, type, x, y, width, height, text) => {
  const style = phaseStyles[id];
  return {
    id,
    type,
    x,
    y,
    width,
    height,
    ...style,
    fillStyle: "solid",
    groupIds: [],
    roughness: 1,
    roundness: type === "diamond" ? null : { type: 3 },
    strokeWidth: id === "PUBLIC" ? 3 : 2,
    label: {
      fontFamily: 2,
      fontSize: 20,
      groupIds: [],
      strokeColor: brand.ink,
      text,
      textAlign: "center",
      verticalAlign: "middle",
    },
  };
};

const arrow = (
  id,
  x,
  y,
  points,
  startId,
  endId,
  options = {},
) => ({
  id,
  type: "arrow",
  x,
  y,
  points,
  groupIds: [],
  roughness: 1,
  roundness: { type: 2 },
  strokeColor: brand.forest,
  strokeStyle: options.strokeStyle || "solid",
  strokeWidth: 2,
  start: { id: startId },
  end: { id: endId },
  startArrowhead: options.startArrowhead || null,
  endArrowhead: "arrow",
  label: options.label
    ? {
        fontFamily: 2,
        fontSize: 16,
        groupIds: [],
        strokeColor: brand.forest,
        text: options.label,
      }
    : undefined,
});

const architectureSkeleton = [
  node("PROSPECT", "rectangle", 0, 40, 180, 80, "Local prospect"),
  node("PUBLIC", "rectangle", 250, 40, 230, 80, "Phase 1\nPublic site"),
  node("DATA", "rectangle", 560, 40, 230, 80, "Phase 2\nClient data"),
  node(
    "DASHBOARD",
    "rectangle",
    0,
    260,
    230,
    80,
    "Operator dashboard",
  ),
  node("QUEUE", "rectangle", 560, 260, 230, 80, "Durable job queue"),
  node(
    "WORKERS",
    "rectangle",
    870,
    260,
    230,
    80,
    "Phase 3\nService workers",
  ),
  node("APPROVAL", "diamond", 890, 465, 190, 110, "Client approval"),
  node("PUBLISH", "rectangle", 1170, 480, 220, 80, "Publish + report"),
  arrow(
    "PROSPECT_PUBLIC",
    180,
    80,
    [
      [0, 0],
      [70, 0],
    ],
    "PROSPECT",
    "PUBLIC",
  ),
  arrow(
    "PUBLIC_DATA",
    480,
    80,
    [
      [0, 0],
      [80, 0],
    ],
    "PUBLIC",
    "DATA",
    { label: "future", strokeStyle: "dashed" },
  ),
  arrow(
    "DATA_QUEUE",
    675,
    120,
    [
      [0, 0],
      [0, 140],
    ],
    "DATA",
    "QUEUE",
  ),
  arrow(
    "QUEUE_WORKERS",
    790,
    300,
    [
      [0, 0],
      [80, 0],
    ],
    "QUEUE",
    "WORKERS",
  ),
  arrow(
    "WORKERS_APPROVAL",
    985,
    340,
    [
      [0, 0],
      [0, 125],
    ],
    "WORKERS",
    "APPROVAL",
  ),
  arrow(
    "APPROVAL_PUBLISH",
    1080,
    520,
    [
      [0, 0],
      [90, 0],
    ],
    "APPROVAL",
    "PUBLISH",
  ),
  arrow(
    "DASHBOARD_DATA",
    230,
    300,
    [
      [0, 0],
      [330, -220],
    ],
    "DASHBOARD",
    "DATA",
    { startArrowhead: "arrow" },
  ),
  arrow(
    "DASHBOARD_QUEUE",
    230,
    300,
    [
      [0, 0],
      [330, 0],
    ],
    "DASHBOARD",
    "QUEUE",
    { label: "replay", strokeStyle: "dashed" },
  ),
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

  dom.window.SVGElement.prototype.getComputedTextLength =
    function getComputedTextLength() {
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

const stableInteger = (value) => {
  let hash = 2166136261;

  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) & 0x7fffffff || 1;
};

const normalizeElements = (elements) => {
  const idMap = new Map(
    elements.map((element) => [
      element.id,
      element.type === "text" && element.containerId
        ? `${element.containerId}_LABEL`
        : element.id,
    ]),
  );

  return elements.map((element) => {
    const id = idMap.get(element.id);

    return {
      ...element,
      id,
      seed: stableInteger(`seed:${id}`),
      versionNonce: stableInteger(`version:${id}`),
      updated: 1,
      containerId: element.containerId
        ? idMap.get(element.containerId)
        : element.containerId,
      boundElements: element.boundElements?.map((binding) => ({
        ...binding,
        id: idMap.get(binding.id) || binding.id,
      })),
      startBinding: element.startBinding
        ? {
            ...element.startBinding,
            elementId:
              idMap.get(element.startBinding.elementId) ||
              element.startBinding.elementId,
          }
        : element.startBinding,
      endBinding: element.endBinding
        ? {
            ...element.endBinding,
            elementId:
              idMap.get(element.endBinding.elementId) ||
              element.endBinding.elementId,
          }
        : element.endBinding,
    };
  });
};

const addAnimationMetadata = (elements) => {
  const orderById = new Map();

  elements.forEach((element) => {
    if (animationOrder[element.id]) {
      orderById.set(element.id, animationOrder[element.id] * 2);
    } else if (element.type === "arrow") {
      const destinationOrder =
        animationOrder[element.endBinding?.elementId] || 20;
      orderById.set(element.id, destinationOrder * 2 - 1);
    }
  });

  elements.forEach((element) => {
    if (element.containerId && orderById.has(element.containerId)) {
      orderById.set(element.id, orderById.get(element.containerId));
    }
  });

  const idMap = new Map(
    elements.map((element, index) => {
      const order = orderById.get(element.id) || 40 + index;
      const duration = element.type === "arrow" ? 220 : 140;
      return [
        element.id,
        `${element.id}|animateOrder:${order}|animateDuration:${duration}`,
      ];
    }),
  );

  return elements.map((element) => ({
    ...element,
    id: idMap.get(element.id),
    containerId: element.containerId
      ? idMap.get(element.containerId)
      : element.containerId,
    boundElements: element.boundElements?.map((binding) => ({
      ...binding,
      id: idMap.get(binding.id) || binding.id,
    })),
    startBinding: element.startBinding
      ? {
          ...element.startBinding,
          elementId:
            idMap.get(element.startBinding.elementId) ||
            element.startBinding.elementId,
        }
      : element.startBinding,
    endBinding: element.endBinding
      ? {
          ...element.endBinding,
          elementId:
            idMap.get(element.endBinding.elementId) ||
            element.endBinding.elementId,
        }
      : element.endBinding,
  }));
};

const interleaveBoundText = (elements) => {
  const labelsByContainer = new Map();

  elements.forEach((element) => {
    if (element.type === "text" && element.containerId) {
      labelsByContainer.set(element.containerId, element);
    }
  });

  const ordered = [];
  elements.forEach((element) => {
    if (element.type === "text" && element.containerId) {
      return;
    }
    ordered.push(element);
    const label = labelsByContainer.get(element.id);
    if (label) {
      ordered.push(label);
    }
  });

  return ordered;
};

const addSvgMetadata = (svg, description) => {
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-labelledby", "diagram-title diagram-description");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  const title = svg.ownerDocument.createElementNS(
    "http://www.w3.org/2000/svg",
    "title",
  );
  title.setAttribute("id", "diagram-title");
  title.textContent = "Beacon & Co. phased system architecture";

  const detail = svg.ownerDocument.createElementNS(
    "http://www.w3.org/2000/svg",
    "desc",
  );
  detail.setAttribute("id", "diagram-description");
  detail.textContent = description;

  svg.prepend(detail);
  svg.prepend(title);
};

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
    const runtime = await import(
      `${pathToFileURL(runtimePath).href}?v=${Date.now()}`
    );
    const converted = runtime.convertToExcalidrawElements(
      architectureSkeleton,
      {
      regenerateIds: false,
      },
    );
    const elements = interleaveBoundText(
      addAnimationMetadata(normalizeElements(converted)),
    );
    const appState = {
      exportBackground: true,
      exportWithDarkMode: false,
      viewBackgroundColor: brand.cream,
    };
    const description =
      "A local prospect enters the implemented Phase 1 public site and contact route. Planned Phase 2 adds Supabase and pg-boss. Planned Phase 3 adds bounded workers, explicit client approval, publishing, reporting, and an operator dashboard.";

    await Promise.all([
      mkdir(outputDirectory, { recursive: true }),
      mkdir(vendorDirectory, { recursive: true }),
    ]);

    await unlink(
      join(vendorDirectory, "mermaid.esm.min.mjs"),
    ).catch(() => {});

    await build({
      entryPoints: [mermaidRuntimeEntry],
      outfile: join(vendorDirectory, "mermaid.min.js"),
      bundle: true,
      platform: "browser",
      format: "iife",
      globalName: "mermaid",
      minify: true,
      logLevel: "silent",
    });

    const staticSvg = await runtime.exportToSvg({
      elements,
      appState,
      files: null,
      exportPadding: 28,
      skipInliningFonts: true,
    });
    addSvgMetadata(staticSvg, description);

    const animatedSvg = staticSvg.cloneNode(true);
    runtime.animateSvg(animatedSvg, elements, { startMs: 250 });

    const excalidrawScene = {
      type: "excalidraw",
      version: 2,
      source: "https://dai-shi.github.io/excalidraw-animate/",
      elements,
      appState: {
        ...appState,
        gridSize: null,
      },
      files: {},
    };

    await Promise.all([
      writeFile(
        join(outputDirectory, "beacon-system.excalidraw"),
        `${JSON.stringify(excalidrawScene, null, 2)}\n`,
      ),
      writeFile(
        join(outputDirectory, "beacon-system-static.svg"),
        `${staticSvg.outerHTML}\n`,
      ),
      writeFile(
        join(outputDirectory, "beacon-system-animated.svg"),
        `${animatedSvg.outerHTML}\n`,
      ),
    ]);

    console.log(
      "Generated architecture assets and staged the local Mermaid runtime",
    );
  } finally {
    dom.window.close();
    await unlink(runtimePath).catch(() => {});
  }
};

await main();
