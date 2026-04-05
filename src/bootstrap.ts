import { buildWorldAndSceneConfig } from "./config/worldAndSceneConfig";
import { bootstrap } from "./infra/domCanvasBootstrap";

/**
 * Top‑level composition entry for the browser runtime.
 */
function main(): void {
  const config = buildWorldAndSceneConfig();
  bootstrap(config);
}

main();
