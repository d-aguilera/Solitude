import type { ProfilerController } from "../app/appPorts.js";
import { CanvasRasterizer } from "../canvas/CanvasRasterizer.js";
import { CanvasSurface } from "../canvas/CanvasSurface.js";
import { NEWTON_G, SOFTENING_LENGTH } from "../domain/domainPorts.js";
import type { GravityEngine, Profiler } from "../domain/domainPorts.js";
import { DefaultRenderer } from "../render/DefaultRenderer.js";
import type {
  Rasterizer,
  Renderer,
  RenderSurface2D,
} from "../render/renderPorts.js";
import { DefaultProfiler } from "./DefaultProfiler.js";
import { runLoop } from "./domGameLoop.js";
import { initInput } from "./domKeyboardInput.js";
import { initLayout } from "./domLayout.js";
import { NewtonianGravityEngine } from "./NewtonianGravityEngine.js";

/**
 * Canvas 2D DOM-level bootstrap
 */
export function bootstrap(): void {
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

  const pilotContext = pilotCanvas.getContext("2d");
  if (!pilotContext) {
    throw new Error("Failed to get 2D context for pilot view canvas");
  }

  const topContext = topCanvas.getContext("2d");
  if (!topContext) {
    throw new Error("Failed to get 2D context for top view canvas");
  }

  const pilotSurface: RenderSurface2D = new CanvasSurface(pilotContext);
  const topSurface: RenderSurface2D = new CanvasSurface(topContext);

  const gravityEngine: GravityEngine = new NewtonianGravityEngine(
    NEWTON_G,
    SOFTENING_LENGTH,
  );
  const defaultProfiler = new DefaultProfiler();
  const profiler: Profiler = defaultProfiler;
  const profilerController: ProfilerController = defaultProfiler;

  const pilotRasterizer: Rasterizer = new CanvasRasterizer();
  const topRasterizer: Rasterizer = new CanvasRasterizer();

  const renderer: Renderer = new DefaultRenderer(
    pilotRasterizer,
    topRasterizer,
  );

  const { controlInput, envInput } = initInput();

  runLoop(
    renderer,
    gravityEngine,
    profiler,
    profilerController,
    pilotSurface,
    topSurface,
    controlInput,
    envInput,
  );
}
