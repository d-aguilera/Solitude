import type { WorldAndSceneConfig } from "../app/configPorts.js";
import type { GravityEngine } from "../domain/domainPorts.js";
import { parameters } from "../global/parameters.js";
import { profilerController } from "../global/profiling.js";
import { DefaultHudRenderer } from "../render/DefaultHudRenderer.js";
import { DefaultViewRenderer } from "../render/DefaultViewRenderer.js";
import type {
  HudRenderer,
  Rasterizer,
  RenderSurface2D,
  ViewRenderer,
} from "../render/renderPorts.js";
import { runLoop } from "./domGameLoop.js";
import { initInput } from "./domKeyboardInput.js";
import { initLayout } from "./domLayout.js";
import { NewtonianGravityEngine } from "./NewtonianGravityEngine.js";
import { initPause } from "./pause.js";

/**
 * DOM-level bootstrap
 */
export function bootstrapWith(
  config: WorldAndSceneConfig,
  makeSurface: (canvas: HTMLCanvasElement) => RenderSurface2D,
  makeRasterizer: (canvas: HTMLCanvasElement) => Rasterizer,
): void {
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

  const { controlInput, envInput } = initInput();

  initPause();

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
  });
}
