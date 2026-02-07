import type { GravityEngine } from "../domain/domainPorts.js";
import { NEWTON_G, SOFTENING_LENGTH } from "../domain/domainPorts.js";
import { profilerController } from "../global/profiling.js";
import { DefaultRenderer } from "../render/DefaultRenderer.js";
import type {
  Rasterizer,
  Renderer,
  RenderSurface2D,
} from "../render/renderPorts.js";
import { WebGLRasterizer } from "../webgl/WebGLRasterizer.js";
import { WebGLSurface } from "../webgl/WebGLSurface.js";
import { runLoop } from "./domGameLoop.js";
import { initInput } from "./domKeyboardInput.js";
import { initLayout } from "./domLayout.js";
import { NewtonianGravityEngine } from "./NewtonianGravityEngine.js";

/**
 * WebGL DOM-level bootstrap
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

  const pilotContext = pilotCanvas.getContext("webgl2");
  if (!pilotContext) {
    throw new Error("Failed to get WebGL2 context for pilot canvas");
  }

  const topContext = topCanvas.getContext("webgl2");
  if (!topContext) {
    throw new Error("Failed to get WebGL2 context for top canvas");
  }

  const pilotSurface: RenderSurface2D = new WebGLSurface(pilotContext);
  const topSurface: RenderSurface2D = new WebGLSurface(topContext);

  const gravityEngine: GravityEngine = new NewtonianGravityEngine(
    NEWTON_G,
    SOFTENING_LENGTH,
  );

  const pilotRasterizer: Rasterizer = new WebGLRasterizer(pilotContext);
  const topRasterizer: Rasterizer = new WebGLRasterizer(topContext);

  const renderer: Renderer = new DefaultRenderer(
    pilotRasterizer,
    topRasterizer,
  );

  const { controlInput, envInput } = initInput();

  runLoop(
    renderer,
    gravityEngine,
    pilotSurface,
    topSurface,
    controlInput,
    envInput,
    profilerController,
  );
}
