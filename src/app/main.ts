import { type GameDependencies } from "./appPorts.js";
import type { TickCallback } from "./appPorts.js";
import { startGame } from "./game.js";

/**
 * Application-level entry point.
 *
 * Wires the core game loop against abstract surfaces and ports
 * and returns a per-frame tick function that outer layers can drive.
 */
export function createApp(deps: GameDependencies): TickCallback {
  const gameDeps: GameDependencies = {
    renderer: deps.renderer,
    gravityEngine: deps.gravityEngine,
    profiler: deps.profiler,
    profilerController: deps.profilerController,
    pilotSurface: deps.pilotSurface,
    topSurface: deps.topSurface,
  };

  return startGame(gameDeps);
}
