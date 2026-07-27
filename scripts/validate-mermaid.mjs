import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";

const diagramDirectory = new URL("../public/diagrams/mermaid/", import.meta.url);
const dom = new JSDOM("<!doctype html><html><body></body></html>");

globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.SVGElement = dom.window.SVGElement;
globalThis.Element = dom.window.Element;
globalThis.Node = dom.window.Node;

const mermaid = (await import("mermaid")).default;
mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
});

const files = (await readdir(diagramDirectory))
  .filter((name) => name.endsWith(".mmd"))
  .sort();

for (const file of files) {
  await mermaid.parse(
    await readFile(join(diagramDirectory.pathname, file), "utf8"),
  );
}

console.log(`Parsed ${files.length} Mermaid diagram sources successfully.`);
