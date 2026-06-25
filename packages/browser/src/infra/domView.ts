import type { ViewDefinition } from "@solitude/engine/render";

export interface DomViewLayers {
  element: HTMLDivElement;
  overlayCanvas: HTMLCanvasElement;
  sceneCanvas: HTMLCanvasElement;
}

export function getOrCreateDomViewLayers(
  container: Element,
  index: number,
  definition: ViewDefinition,
): DomViewLayers {
  const elementId = createViewElementId(index);
  let element = document.getElementById(elementId) as HTMLDivElement | null;
  if (!element) {
    element = document.createElement("div");
    element.id = elementId;
  }
  element.className = "scene-view";
  element.classList.toggle("pip-view", definition.layout.kind === "pip");
  applyViewElementStyle(element);

  const sceneCanvas = getOrCreateCanvas(element, `${elementId}-scene`, "scene");
  const overlayCanvas = getOrCreateCanvas(
    element,
    `${elementId}-overlay`,
    "overlay",
  );

  syncViewTitleElement(element, `${elementId}-title`, definition);

  if (element.parentElement !== container) container.appendChild(element);
  return { element, overlayCanvas, sceneCanvas };
}

export function removeExtraDomViews(
  container: Element,
  nextIndex: number,
): void {
  for (;;) {
    const element = document.getElementById(createViewElementId(nextIndex));
    if (!element || element.parentElement !== container) return;
    element.remove();
    nextIndex++;
  }
}

export function orderViewDefinitionsPrimaryFirst(
  definitions: readonly ViewDefinition[],
): ViewDefinition[] {
  const ordered: ViewDefinition[] = [];
  for (const definition of definitions) {
    if (definition.layout.kind === "primary") ordered.push(definition);
  }
  for (const definition of definitions) {
    if (definition.layout.kind !== "primary") ordered.push(definition);
  }
  return ordered;
}

function createViewElementId(index: number): string {
  return `sceneView-${index}`;
}

function syncViewTitleElement(
  parent: HTMLDivElement,
  id: string,
  { layout, title }: ViewDefinition,
): void {
  let element = document.getElementById(id) as HTMLSpanElement | null;
  if (!title) {
    element?.remove();
    return;
  }
  if (!element) {
    element = document.createElement("span");
    element.id = id;
  }
  element.className = "scene-view-title";
  element.textContent = title;
  const style = element.style;
  style.position = "absolute";
  style.top = "0";
  style.left = "";
  style.right = "";
  if (layout.kind === "pip" && layout.horizontal === "right") {
    style.right = "0";
  } else {
    style.left = "0";
  }
  style.padding = ".1ex 1ex";
  style.background = "rgba(0, 0, 0, 0.5)";
  style.color = "white";
  style.fontFamily = "monospace";
  style.fontSize = "14px";
  style.pointerEvents = "none";
  if (element.parentElement !== parent) parent.appendChild(element);
}

function getOrCreateCanvas(
  parent: HTMLDivElement,
  id: string,
  layer: "overlay" | "scene",
): HTMLCanvasElement {
  let element = document.getElementById(id) as HTMLCanvasElement | null;
  if (!element) {
    element = document.createElement("canvas");
    element.id = id;
  }
  element.dataset.layer = layer;
  const style = element.style;
  style.position = "absolute";
  style.inset = "0";
  style.width = "100%";
  style.height = "100%";
  style.display = "block";
  style.pointerEvents = "none";
  style.background = layer === "overlay" ? "transparent" : "black";
  if (element.parentElement !== parent) parent.appendChild(element);
  return element;
}

function applyViewElementStyle(element: HTMLDivElement): void {
  const style = element.style;
  style.position = "absolute";
  style.overflow = "hidden";
  style.background = "black";
  style.pointerEvents = "none";
}
