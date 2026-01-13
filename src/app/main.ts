import { startGame } from "./game.js";
import type { Renderer } from "./rendererPort.js";
import type { GravityEngine } from "../world/physics/gravityPort.js";
import type { Profiler } from "../world/types.js";

/**
 * App-level entry point.
 *
 * This function assumes that:
 *  - A concrete Renderer has already been constructed by an outer layer.
 *  - A concrete GravityEngine has already been constructed by an outer layer.
 *  - A Profiler implementation has been chosen by an outer layer.
 *
 * It delegates entirely to the game loop without any knowledge of
 * DOM, canvas, or other infrastructure details.
 */
export function runApp(
  renderer: Renderer,
  gravityEngine: GravityEngine,
  profiler: Profiler
): void {
  startGame(renderer, gravityEngine, profiler);
}
