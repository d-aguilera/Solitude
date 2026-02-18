import type { GameplayParameters } from "./app/appPorts.js";
import { bootstrap } from "./infra/domCanvasBootstrap.js";

/**
 * Top‑level composition entry for the browser runtime.
 */
function main(): void {
  const gameplayParameters: GameplayParameters = {
    timeScale: 1, // real time
    // timeScale: 1_024, // 17m 4s per actual second
    // timeScale: 65_536, // 18h 12m 16s per actual second
    // timeScale: 262_144, // 3d 0h 49m 4s per actual second
  };

  bootstrap(gameplayParameters);
}

main();
