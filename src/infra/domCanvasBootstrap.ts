import { CanvasRenderer } from "../render/canvas/CanvasRenderer.js";
import { NewtonianGravityEngine } from "../domain/NewtonianGravityEngine.js";
import { defaultProfiler } from "../profiling/profilingFacade.js";
import { runApp } from "../app/main.js";

/**
 * DOM-level bootstrap responsible for:
 *  - Looking up canvas elements in the document
 *  - Constructing the concrete CanvasRenderer
 *  - Wiring a concrete GravityEngine and Profiler
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

  const renderer = new CanvasRenderer();
  const gravityEngine = new NewtonianGravityEngine();
  const profiler = defaultProfiler;

  runApp(renderer, gravityEngine, profiler, {
    container,
    pilotCanvas,
    topCanvas,
  });
}
