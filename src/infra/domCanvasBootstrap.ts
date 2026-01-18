import type { GameDependencies } from "../app/appPorts.js";
import { CanvasRenderer } from "../canvas/CanvasRenderer.js";
import { CanvasSurface } from "../canvas/CanvasSurface.js";
import { init as initResizeHandler } from "../canvas/canvasLayout.js";
import type { GravityEngine, Profiler } from "../domain/domainPorts.js";
import { NewtonianGravityEngine } from "../domain/NewtonianGravityEngine.js";
import { DefaultProfiler } from "../profiling/DefaultProfiler.js";
import type { ProfilerController } from "../app/appPorts.js";
import type { Renderer } from "../render/renderPorts.js";
import { runDomGameLoop } from "./domGameLoop.js";

/**
 * DOM-level bootstrap responsible for:
 *  - Looking up canvas elements in the document
 *  - Wiring concrete Renderer, GravityEngine and Profiler instances
 *  - Creating RenderSurface2D adapters for Canvas2D
 *  - Starting the DOM-driven game loop
 */
export function bootstrapDomApp(): void {
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

  initResizeHandler(container, pilotCanvas, topCanvas);

  const pilotContext = pilotCanvas.getContext("2d");
  if (!pilotContext) {
    throw new Error("Failed to get 2D context for pilot view canvas");
  }

  const topContext = topCanvas.getContext("2d");
  if (!topContext) {
    throw new Error("Failed to get 2D context for top view canvas");
  }

  const pilotSurface = new CanvasSurface(pilotContext);
  const topSurface = new CanvasSurface(topContext);

  const gravityEngine: GravityEngine = new NewtonianGravityEngine();
  const defaultProfiler = new DefaultProfiler();
  const profiler: Profiler = defaultProfiler;
  const profilerController: ProfilerController = defaultProfiler;
  const renderer: Renderer = new CanvasRenderer(profiler);

  const deps: GameDependencies = {
    renderer,
    gravityEngine,
    profiler,
    profilerController,
    pilotSurface,
    topSurface,
  };

  runDomGameLoop(deps);
}
