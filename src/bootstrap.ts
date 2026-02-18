import type { GameplayParameters } from "./app/appPorts.js";
import { bootstrap } from "./infra/domCanvasBootstrap.js";

/**
 * Top‑level composition entry for the browser runtime.
 */
function main(): void {
  const gameplayParameters: GameplayParameters = {
    simulationTimeScale: 1, // real time
  };

  bootstrap(gameplayParameters);
}

main();
