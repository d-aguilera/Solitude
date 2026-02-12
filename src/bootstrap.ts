import type { GameplayParameters } from "./app/appPorts.js";
import { bootstrap } from "./infra/domCanvasBootstrap.js";

/**
 * Top‑level composition entry for the browser runtime.
 */
function main(): void {
  const gameplayParameters: GameplayParameters = {
    simulationTimeScale: 1000, // 16' 40" per real second
  };

  bootstrap(gameplayParameters);
}

main();
