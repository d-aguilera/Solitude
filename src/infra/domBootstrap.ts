import type { WorldAndSceneConfig } from "../app/configPorts";
import type { GravityEngine } from "../domain/domainPorts";
import { parameters } from "../global/parameters";
import { profilerController } from "../global/profiling";
import { loadPlugins } from "../plugins/index";
import { DefaultHudRenderer } from "../render/DefaultHudRenderer";
import { DefaultViewRenderer } from "../render/DefaultViewRenderer";
import type {
  HudRenderer,
  Rasterizer,
  RenderSurface2D,
  ViewRenderer,
} from "../render/renderPorts";
import { runLoop } from "./domGameLoop";
import { initInput } from "./domKeyboardInput";
import { initLayout } from "./domLayout";
import { NewtonianGravityEngine } from "./NewtonianGravityEngine";

/**
 * DOM-level bootstrap
 */
export function bootstrapWith(
  config: WorldAndSceneConfig,
  makeSurface: (canvas: HTMLCanvasElement) => RenderSurface2D,
  makeRasterizer: (canvas: HTMLCanvasElement) => Rasterizer,
): void {
  const plugins = loadPlugins(["autopilot", "pause", "trajectories"]);
  const container = document.querySelector(".canvas-container");
  if (!container) {
    throw new Error("Required '.canvas-container' not found in document");
  }

  const pilotCanvas = document.getElementById(
    "pilotViewCanvas",
  ) as HTMLCanvasElement | null;
  if (!pilotCanvas) {
    throw new Error("Required 'pilotViewCanvas' not found in document");
  }

  const topCanvas = document.getElementById(
    "topViewCanvas",
  ) as HTMLCanvasElement | null;
  if (!topCanvas) {
    throw new Error("Required 'topViewCanvas' not found in document");
  }

  initLayout(container, pilotCanvas, topCanvas);

  const pilotSurface: RenderSurface2D = makeSurface(pilotCanvas);
  const topSurface: RenderSurface2D = makeSurface(topCanvas);

  const gravityEngine: GravityEngine = new NewtonianGravityEngine(
    parameters.newtonG,
    parameters.softeningLength,
  );

  const pilotRasterizer: Rasterizer = makeRasterizer(pilotCanvas);
  const pilotViewRenderer: ViewRenderer = new DefaultViewRenderer(
    (text: string, font: string) => pilotRasterizer.measureText(text, font),
  );

  const topRasterizer: Rasterizer = makeRasterizer(topCanvas);
  const topViewRenderer: ViewRenderer = new DefaultViewRenderer(
    (text: string, font: string) => topRasterizer.measureText(text, font),
  );

  const hudRasterizer = pilotRasterizer;
  const hudRenderer: HudRenderer = new DefaultHudRenderer();

  const { controlInput, envInput } = initInput(plugins);

  runLoop({
    config,
    pilotViewRenderer,
    pilotRasterizer,
    topViewRenderer,
    topRasterizer,
    hudRenderer,
    hudRasterizer,
    gravityEngine,
    pilotSurface,
    topSurface,
    controlInput,
    envInput,
    profilerController,
    plugins,
  });
}
