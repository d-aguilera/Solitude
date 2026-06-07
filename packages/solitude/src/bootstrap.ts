import { bootstrap } from "@solitude/browser/dom/canvasBootstrap";
import { parseRuntimeOptionsFromSearch } from "@solitude/browser/dom/runtimeOptions";
import { loadPlugins } from "@solitude/engine/plugin";
import { applyWorldModelPlugins } from "@solitude/engine/world";
import { buildWorldAndSceneConfig } from "@solitude/sim/config/worldAndSceneConfig";
import { defaultPluginIds, solitudePluginCatalog } from "./plugins/catalog";

/**
 * Top‑level composition entry for the browser runtime.
 */
function main(): void {
  const runtimeOptions = parseRuntimeOptionsFromSearch(window.location.search);
  const plugins = loadPlugins({
    catalog: solitudePluginCatalog,
    ids: defaultPluginIds,
    runtimeOptions,
  });
  const config = buildWorldAndSceneConfig();
  applyWorldModelPlugins(config, plugins);
  bootstrap(config, plugins);
}

main();
