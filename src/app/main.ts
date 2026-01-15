import { startGame } from "./game.js";
import type { Renderer } from "./rendererPort.js";
import type { GravityEngine } from "../world/physics/GravityEngine.js";
import { init as initResizeHandler } from "../render/canvas/canvasLayout.js";
import type { Profiler } from "../world/domain.js";

export interface AppEnvironment {
  container: Element;
  pilotCanvas: HTMLCanvasElement;
  topCanvas: HTMLCanvasElement;
}

export function runApp(
  renderer: Renderer,
  gravityEngine: GravityEngine,
  profiler: Profiler,
  env: AppEnvironment
): void {
  initResizeHandler(env.container, env.pilotCanvas, env.topCanvas);

  startGame(renderer, gravityEngine, profiler, {
    pilotContext: env.pilotCanvas.getContext("2d") as CanvasRenderingContext2D,
    topContext: env.topCanvas.getContext("2d") as CanvasRenderingContext2D,
  });
}
