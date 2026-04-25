import { applyWorldModelPlugins } from "./app/worldModelConfig";
import { buildWorldAndSceneConfig } from "./config/worldAndSceneConfig";
import { bootstrap } from "./infra/domCanvasBootstrap";
import { parseRuntimeOptionsFromSearch } from "./infra/domRuntimeOptions";
import { defaultPluginIds, loadPlugins } from "./plugins/index";

/**
 * Top‑level composition entry for the browser runtime.
 */
function main(): void {
  const runtimeOptions = parseRuntimeOptionsFromSearch(window.location.search);
  const plugins = loadPlugins(defaultPluginIds, runtimeOptions);
  const config = buildWorldAndSceneConfig();
  applyWorldModelPlugins(config, plugins);
  bootstrap(config, plugins);
}

main();
