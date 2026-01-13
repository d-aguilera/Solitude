import { startGame } from "./app/game.js";
import { defaultProfiler } from "./profiling/profilingFacade.js";
import { init as initResizeHandler } from "./render/canvas/canvasLayout.js";
import { CanvasRenderer } from "./render/canvas/canvasRenderer.js";
import { NewtonianGravityEngine } from "./world/physics/newtonianGravityEngine.js";

/**
 * Composition root responsible for wiring:
 *  - DOM / canvas elements
 *  - Concrete Renderer (CanvasRenderer)
 *  - Concrete GravityEngine
 *  - Profiling
 */
function main(): void {
  const container = document.querySelector(".canvas-container");
  if (!container) {
    throw new Error("Required '.canvas-container' not found in document");
  }

  const pilotCanvas = document.getElementById(
    "pilotViewCanvas"
  ) as HTMLCanvasElement | null;

  if (!pilotCanvas) {
    throw new Error("Required 'pilotViewCanvas' not found in document");
  }

  const pilotContext = pilotCanvas.getContext("2d");
  if (!pilotContext) {
    throw new Error("Failed to get 2D context for pilot view canvas");
  }

  const topCanvas = document.getElementById(
    "topViewCanvas"
  ) as HTMLCanvasElement | null;

  if (!topCanvas) {
    throw new Error("Required 'topViewCanvas' not found in document");
  }

  const topContext = topCanvas.getContext("2d");
  if (!topContext) {
    throw new Error("Failed to get 2D context for top view canvas");
  }

  // Concrete Canvas2D adapter implementing the Renderer port.
  const renderer = new CanvasRenderer(pilotContext, topContext);

  // Concrete gravity engine implementing the GravityEngine port.
  const gravityEngine = new NewtonianGravityEngine();

  initResizeHandler(container, pilotCanvas, topCanvas);
  startGame(renderer, gravityEngine, defaultProfiler);
}

main();
