import { CanvasRenderer } from "../render/canvas/CanvasRenderer.js";
import { NewtonianGravityEngine } from "../world/physics/NewtonianGravityEngine.js";
import { defaultProfiler } from "../profiling/profilingFacade.js";
import { runApp } from "../app/main.js";

/**
 * DOM‑level bootstrap responsible for:
 *  - Looking up canvas elements in the document
 *  - Constructing the concrete CanvasRenderer
 *  - Wiring a concrete GravityEngine and Profiler
 *
 * This module is intentionally kept at the outermost layer so that
 * the app/game code remains decoupled from DOM and canvas concerns.
 */
export function bootstrapDomApp(): void {
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

  const topCanvas = document.getElementById(
    "topViewCanvas"
  ) as HTMLCanvasElement | null;
  if (!topCanvas) {
    throw new Error("Required 'topViewCanvas' not found in document");
  }

  const pilotContext = pilotCanvas.getContext("2d");
  if (!pilotContext) {
    throw new Error("Failed to get 2D context for pilot view canvas");
  }

  const topContext = topCanvas.getContext("2d");
  if (!topContext) {
    throw new Error("Failed to get 2D context for top view canvas");
  }

  const renderer = new CanvasRenderer();
  const gravityEngine = new NewtonianGravityEngine();
  const profiler = defaultProfiler;

  // This remains the only place that knows about both DOM and the app.
  runApp(renderer, gravityEngine, profiler, {
    container,
    pilotCanvas,
    topCanvas,
  });
}
