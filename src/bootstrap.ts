import { buildWorldAndSceneConfig } from "./config/worldAndSceneConfig";
import { bootstrap } from "./infra/domCanvasBootstrap";
import { parseRuntimeOptionsFromSearch } from "./infra/domRuntimeOptions";

/**
 * Top‑level composition entry for the browser runtime.
 */
function main(): void {
  const config = buildWorldAndSceneConfig();
  const runtimeOptions = parseRuntimeOptionsFromSearch(window.location.search);
  bootstrap(config, runtimeOptions);
}

main();
