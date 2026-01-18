import { init as initResizeHandler } from "../canvas/canvasLayout.js";
import type { GravityEngine, Profiler } from "../domain/domainPorts.js";
import type { Renderer } from "../render/renderPorts.js";
import { runDomGameLoop } from "../infra/domGameLoop.js";
import type { AppEnvironment } from "./appInternals.js";
import { ProfilerController } from "./appPorts.js";

export function runApp(
  renderer: Renderer,
  gravityEngine: GravityEngine,
  profiler: Profiler & ProfilerController,
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

  runDomGameLoop({
    renderer,
    gravityEngine,
    profiler,
    pilotContext,
    topContext,
  });
}
