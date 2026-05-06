import type { WorldAndSceneConfig } from "@solitude/engine/app/configPorts";
import type { GamePlugin } from "@solitude/engine/app/pluginPorts";
import type { ViewDefinition } from "@solitude/engine/app/viewPorts";
import { buildViewDefinitions } from "@solitude/engine/app/viewRegistry";
import type { GravityEngine } from "@solitude/engine/domain/domainPorts";
import { parameters } from "@solitude/engine/global/parameters";
import { NewtonianGravityEngine } from "@solitude/engine/infra/NewtonianGravityEngine";
import { DefaultHudRenderer } from "@solitude/engine/render/DefaultHudRenderer";
import { DefaultViewRenderer } from "@solitude/engine/render/DefaultViewRenderer";
import type {
  HudRenderer,
  Rasterizer,
  RenderSurface2D,
} from "@solitude/engine/render/renderPorts";
import { runLoop } from "./domGameLoop";
import { initInput } from "./domKeyboardInput";
import { initLayout, type LayoutView } from "./domLayout";
import type { RunLoopView } from "./infraPorts";

/**
 * DOM-level bootstrap
 */
export function bootstrapWith(
  config: WorldAndSceneConfig,
  makeSurface: (canvas: HTMLCanvasElement) => RenderSurface2D,
  makeRasterizer: (canvas: HTMLCanvasElement) => Rasterizer,
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

  const views = createRunLoopViews(viewCanvases, makeSurface, makeRasterizer);
  const primaryView = getRequiredPrimaryRunLoopView(views);
  const hudRasterizer = primaryView.rasterizer;
  const hudRenderer: HudRenderer = new DefaultHudRenderer();

  const { controlInput } = initInput(plugins);

  runLoop({
    config,
    views,
    hudRenderer,
    hudRasterizer,
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

function getRequiredPrimaryRunLoopView(views: RunLoopView[]): RunLoopView {
  let primaryView: RunLoopView | null = null;
  for (const view of views) {
    if (view.definition.layout.kind !== "primary") continue;
    if (primaryView) {
      throw new Error("Multiple primary views registered");
    }
    primaryView = view;
  }
  if (!primaryView) {
    throw new Error("Required primary view not registered");
  }
  return primaryView;
}

function createRunLoopViews(
  views: LayoutViewPlusDefinition[],
  makeSurface: (canvas: HTMLCanvasElement) => RenderSurface2D,
  makeRasterizer: (canvas: HTMLCanvasElement) => Rasterizer,
): RunLoopView[] {
  const result: RunLoopView[] = [];
  for (const view of views) {
    const rasterizer = makeRasterizer(view.canvas);
    result.push({
      definition: view.definition,
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
