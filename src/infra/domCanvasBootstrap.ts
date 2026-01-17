import { runApp } from "../app/main.js";
import { CanvasRenderer } from "../canvas/CanvasRenderer.js";
import type { GravityEngine } from "../domain/domainPorts.js";
import { NewtonianGravityEngine } from "../domain/NewtonianGravityEngine.js";
import { DefaultProfiler } from "../profiling/DefaultProfiler.js";
import type { Profiler } from "../profiling/profilingPorts.js";
import type { Renderer } from "../render/renderPorts.js";

/**
 * DOM-level bootstrap responsible for:
 *  - Looking up canvas elements in the document
 *  - Wiring concrete Renderer, GravityEngine and Profiler instances
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

  const gravityEngine: GravityEngine = new NewtonianGravityEngine();
  const profiler: Profiler = new DefaultProfiler();
  const renderer: Renderer = new CanvasRenderer();

  runApp(renderer, gravityEngine, profiler, {
    container,
    pilotCanvas,
    topCanvas,
  });
}
