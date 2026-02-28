import { buildWorldAndSceneConfig } from "./config/worldAndSceneConfig.js";
import { bootstrap } from "./infra/domCanvasBootstrap.js";

/**
 * Top‑level composition entry for the browser runtime.
 */
function main(): void {
  const config = buildWorldAndSceneConfig();
  bootstrap(config);
}

main();
