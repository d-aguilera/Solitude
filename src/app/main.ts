import { startGame } from "./game.js";
import type { GravityEngine } from "../domain/domainPorts.js";
import { init as initResizeHandler } from "../render/canvas/canvasLayout.js";
import type { AppEnvironment } from "./appPorts.js";
import type { Profiler } from "../profiling/profilingPorts.js";
import type { Renderer } from "../render/renderPorts.js";

export function runApp(
  renderer: Renderer,
  gravityEngine: GravityEngine,
  profiler: Profiler,
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

  startGame(renderer, gravityEngine, profiler, {
    pilotContext,
    topContext,
  });
}
