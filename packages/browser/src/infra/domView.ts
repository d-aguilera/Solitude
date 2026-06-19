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

function getOrCreateCanvas(
  parent: HTMLDivElement,
  id: string,
  layer: "overlay" | "scene",
): HTMLCanvasElement {
  let canvas = document.getElementById(id) as HTMLCanvasElement | null;
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = id;
  }
  canvas.dataset.layer = layer;
  canvas.style.position = "absolute";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  canvas.style.pointerEvents = "none";
  canvas.style.background = layer === "overlay" ? "transparent" : "black";
  if (canvas.parentElement !== parent) parent.appendChild(canvas);
  return canvas;
}

function applyViewElementStyle(element: HTMLDivElement): void {
  element.style.position = "absolute";
  element.style.overflow = "hidden";
  element.style.background = "black";
  element.style.pointerEvents = "none";
}
