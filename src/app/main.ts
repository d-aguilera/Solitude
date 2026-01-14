import { startGame } from "./game.js";
import type { Renderer } from "./rendererPort.js";
import type { GravityEngine } from "../world/physics/gravityPort.js";
import { init as initResizeHandler } from "../render/canvas/canvasLayout.js";
import { Profiler } from "../world/domain.js";

export interface AppEnvironment {
  /**
   * Root container used for layout decisions.
   */
  container: Element;
  /**
   * Pilot view canvas used by the concrete renderer.
   */
  pilotCanvas: HTMLCanvasElement;
  /**
   * Top view canvas used by the concrete renderer.
   */
  topCanvas: HTMLCanvasElement;
}

/**
 * App-level entry point.
 *
 * This function assumes that:
 *  - A concrete Renderer has already been constructed by an outer layer.
 *  - A concrete GravityEngine has already been constructed by an outer layer.
 *  - A Profiler implementation has been chosen by an outer layer.
 *  - Environment-specific wiring (DOM, canvases) is provided explicitly.
 */
export function runApp(
  renderer: Renderer,
  gravityEngine: GravityEngine,
  profiler: Profiler,
  env: AppEnvironment
): void {
  // Environment-specific setup (canvas layout) is parameterized and
  // performed here instead of being hidden inside the game loop.
  initResizeHandler(env.container, env.pilotCanvas, env.topCanvas);

  startGame(renderer, gravityEngine, profiler);
}
