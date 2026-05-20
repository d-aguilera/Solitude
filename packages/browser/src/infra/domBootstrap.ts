import type { WorldAndSceneConfig } from "@solitude/engine/app/configPorts";
import type { ViewDefinition } from "@solitude/engine/app/viewPorts";
import { buildViewDefinitions } from "@solitude/engine/app/viewRegistry";
import type { GravityEngine } from "@solitude/engine/domain/domainPorts";
import { parameters } from "@solitude/engine/global/parameters";
import { NewtonianGravityEngine } from "@solitude/engine/infra/NewtonianGravityEngine";
import type { GamePlugin } from "@solitude/engine/plugin";
import { DefaultViewRenderer } from "@solitude/engine/render/DefaultViewRenderer";
import type {
  Rasterizer,
  RenderSurface2D,
} from "@solitude/engine/render/renderPorts";
import { runLoop } from "./domGameLoop";
import { initInput } from "./domKeyboardInput";
import { initLayout, type LayoutView } from "./domLayout";
import type { RunLoopView } from "./infraPorts";
import type { OverlayRasterizer } from "./overlayPorts";

/**
 * DOM-level bootstrap
 */
export function bootstrapWith(
  config: WorldAndSceneConfig,
  makeSurface: (canvas: HTMLCanvasElement) => RenderSurface2D,
  makeRasterizer: (canvas: HTMLCanvasElement) => Rasterizer,
  makeOverlayRasterizer: (
    canvas: HTMLCanvasElement,
  ) => OverlayRasterizer | null,
  plugins: GamePlugin[],
): void {
  const container = document.querySelector(".canvas-container");
  if (!container) {
    throw new Error("Required '.canvas-container' not found in document");
  }

  const viewDefinitions = buildViewDefinitions(config, plugins);
  const viewCanvases = createViewCanvases(container, viewDefinitions);
  initLayout(container, viewCanvases);

  const gravityEngine: GravityEngine = new NewtonianGravityEngine(
    parameters.newtonG,
    parameters.softeningLength,
  );

  const views = createRunLoopViews(
    viewCanvases,
    makeSurface,
    makeRasterizer,
    makeOverlayRasterizer,
  );

  const { controlInput } = initInput(plugins);

  runLoop({
    config,
    views,
    gravityEngine,
    controlInput,
    plugins,
  });
}

type LayoutViewPlusDefinition = LayoutView & { definition: ViewDefinition };

function createViewCanvases(
  container: Element,
  definitions: ViewDefinition[],
): LayoutViewPlusDefinition[] {
  const views: LayoutViewPlusDefinition[] = [];
  let index = 0;
  for (const definition of primaryDefinitionsFirst(definitions)) {
    const canvas = getOrCreateViewCanvas(
      container,
      createViewCanvasId(index),
      definition,
    );
    views.push({
      canvas,
      definition,
      layout: definition.layout,
    });
    index++;
  }
  return views;
}

function primaryDefinitionsFirst(
  definitions: ViewDefinition[],
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

function getOrCreateViewCanvas(
  container: Element,
  elementId: string,
  definition: ViewDefinition,
): HTMLCanvasElement {
  let canvas = document.getElementById(elementId) as HTMLCanvasElement | null;
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = elementId;
  }

  canvas.classList.toggle("pip-canvas", definition.layout.kind === "pip");
  if (canvas.parentElement !== container) {
    container.appendChild(canvas);
  }

  return canvas;
}

function createViewCanvasId(index: number): string {
  return `sceneViewCanvas-${index}`;
}

function createRunLoopViews(
  views: LayoutViewPlusDefinition[],
  makeSurface: (canvas: HTMLCanvasElement) => RenderSurface2D,
  makeRasterizer: (canvas: HTMLCanvasElement) => Rasterizer,
  makeOverlayRasterizer: (
    canvas: HTMLCanvasElement,
  ) => OverlayRasterizer | null,
): RunLoopView[] {
  const result: RunLoopView[] = [];
  for (const view of views) {
    const rasterizer = makeRasterizer(view.canvas);
    result.push({
      definition: view.definition,
      overlayRasterizer: makeOverlayRasterizer(view.canvas),
      rasterizer,
      renderer: new DefaultViewRenderer(
        (text: string, font: string) => rasterizer.measureText(text, font),
        view.definition.labelMode,
      ),
      surface: makeSurface(view.canvas),
    });
  }
  return result;
}
