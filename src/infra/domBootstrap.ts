import type { WorldAndSceneConfig } from "../app/configPorts";
import type { ViewDefinition } from "../app/viewPorts";
import { buildViewDefinitions } from "../app/viewRegistry";
import type { GravityEngine } from "../domain/domainPorts";
import { parameters } from "../global/parameters";
import { loadPlugins } from "../plugins/index";
import { DefaultHudRenderer } from "../render/DefaultHudRenderer";
import { DefaultViewRenderer } from "../render/DefaultViewRenderer";
import type {
  HudRenderer,
  Rasterizer,
  RenderSurface2D,
} from "../render/renderPorts";
import { runLoop } from "./domGameLoop";
import { initInput } from "./domKeyboardInput";
import { initLayout, type LayoutView } from "./domLayout";
import type { RunLoopView } from "./infraPorts";
import { NewtonianGravityEngine } from "./NewtonianGravityEngine";

/**
 * DOM-level bootstrap
 */
export function bootstrapWith(
  config: WorldAndSceneConfig,
  makeSurface: (canvas: HTMLCanvasElement) => RenderSurface2D,
  makeRasterizer: (canvas: HTMLCanvasElement) => Rasterizer,
): void {
  const plugins = loadPlugins([
    "axialViews",
    "orbitTelemetry",
    "runtimeTelemetry",
    "shipTelemetry",
    "autopilot",
    "memory",
    "pause",
    "profiling",
    "timeScale",
    "trajectories",
    "velocitySegments",
  ]);

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
  for (const definition of definitions) {
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
