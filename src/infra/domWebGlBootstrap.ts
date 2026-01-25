import { DefaultRenderer } from "../render/DefaultRenderer.js";
import { init as initResizeHandler } from "../canvas/canvasLayout.js";
import type { GravityEngine, Profiler } from "../domain/domainPorts.js";
import { NewtonianGravityEngine } from "../domain/NewtonianGravityEngine.js";
import { DefaultProfiler } from "./DefaultProfiler.js";
import type { ProfilerController } from "../app/appPorts.js";
import type { Rasterizer, Renderer } from "../render/renderPorts.js";
import type { RenderSurface2D } from "../render/renderPorts.js";
import { runDomGameLoop } from "./domGameLoop.js";
import { WebGLSurface } from "../webgl/WebGLSurface.js";
import { WebGLRasterizer } from "../webgl/WebGLRasterizer.js";

export function bootstrapDomWebGlApp(): void {
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

  const glPilot = pilotCanvas.getContext("webgl2");
  if (!glPilot) {
    throw new Error("Failed to get WebGL2 context for pilot canvas");
  }

  const glTop = topCanvas.getContext("webgl2");
  if (!glTop) {
    throw new Error("Failed to get WebGL2 context for top canvas");
  }

  const pilotSurface: RenderSurface2D = new WebGLSurface(glPilot);
  const topSurface: RenderSurface2D = new WebGLSurface(glTop);

  const gravityEngine: GravityEngine = new NewtonianGravityEngine();
  const defaultProfiler = new DefaultProfiler();
  const profiler: Profiler = defaultProfiler;
  const profilerController: ProfilerController = defaultProfiler;

  const pilotRasterizer: Rasterizer = new WebGLRasterizer(glPilot);
  const topRasterizer: Rasterizer = new WebGLRasterizer(glTop);

  const renderer: Renderer = new DefaultRenderer(
    pilotRasterizer,
    topRasterizer,
    profilerController,
  );

  runDomGameLoop(
    renderer,
    gravityEngine,
    profiler,
    profilerController,
    pilotSurface,
    topSurface,
  );
}
