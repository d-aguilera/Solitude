import { startGame } from "./game.js";
import type { Renderer } from "./appPorts.js";
import type { GravityEngine } from "../domain/domainPorts.js";
import { init as initResizeHandler } from "../render/canvas/canvasLayout.js";
import type { Profiler } from "./profilingPorts.js";
import { AppEnvironment } from "./appPorts.js";

export function runApp(
  renderer: Renderer,
  gravityEngine: GravityEngine,
  profiler: Profiler,
  env: AppEnvironment,
): void {
  initResizeHandler(env.container, env.pilotCanvas, env.topCanvas);

  startGame(renderer, gravityEngine, profiler, {
    pilotContext: env.pilotCanvas.getContext("2d") as CanvasRenderingContext2D,
    topContext: env.topCanvas.getContext("2d") as CanvasRenderingContext2D,
  });
}
