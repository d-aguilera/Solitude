import { init as initResizeHandler } from "../canvas/canvasLayout.js";
import { CanvasSurface } from "../canvas/CanvasSurface.js";
import type { GravityEngine, Profiler } from "../domain/domainPorts.js";
import { runDomGameLoop } from "../infra/domGameLoop.js";
import type { Renderer } from "../render/renderPorts.js";
import type { AppEnvironment } from "./appInternals.js";
import type { ProfilerController } from "./appPorts.js";

export function runApp(
  renderer: Renderer,
  gravityEngine: GravityEngine,
  profiler: Profiler,
  profilerController: ProfilerController,
  env: AppEnvironment,
): void {
  initResizeHandler(env.container, env.pilotCanvas, env.topCanvas);

  const pilotContext = env.pilotCanvas.getContext("2d");
  if (!pilotContext) {
    throw new Error("Failed to get 2D context for pilot view canvas");
  }

  const topContext = env.topCanvas.getContext("2d");
  if (!topContext) {
    throw new Error("Failed to get 2D context for top view canvas");
  }

  const pilotSurface = new CanvasSurface(pilotContext);
  const topSurface = new CanvasSurface(topContext);

  runDomGameLoop({
    renderer,
    gravityEngine,
    profiler,
    profilerController,
    pilotSurface,
    topSurface,
  });
}
