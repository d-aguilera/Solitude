import type { RenderFailure } from "@solitude/browser/dom/renderFailure";
import { showRenderFailurePanel } from "@solitude/browser/dom/renderFailurePanel";
import { bootstrapRendering } from "@solitude/browser/dom/renderingBootstrap";
import { parseRuntimeOptionsFromSearch } from "@solitude/browser/dom/runtimeOptions";
import { loadPlugins } from "@solitude/engine/plugin";
import { applyWorldModelPlugins } from "@solitude/engine/world";
import {
  createRuntimeOptionsWithResolvedLocale,
  resolveSolitudeLocale,
} from "@solitude/localization";
import {
  appendExternalPluginSet,
  loadBrowserPlugins,
} from "@solitude/plugin-runtime";
import { buildWorldAndSceneConfig } from "@solitude/sim/config/worldAndSceneConfig";
import { defaultPluginIds, solitudePluginCatalog } from "./plugins/catalog";
import { getRendererFailureMessages } from "./rendererFailureLocalization";

/**
 * Top‑level composition entry for the browser runtime.
 */
async function main(): Promise<void> {
  const runtimeOptions = createRuntimeOptionsWithResolvedLocale(
    parseRuntimeOptionsFromSearch(window.location.search),
    navigator.languages,
  );
  const externalPlugins = await loadBrowserPlugins(
    new URL("./plugins/loader.json", document.baseURI).href,
  );
  const pluginSet = appendExternalPluginSet(
    solitudePluginCatalog,
    defaultPluginIds,
    externalPlugins,
  );
  const plugins = loadPlugins({
    catalog: pluginSet.catalog,
    ids: pluginSet.ids,
    runtimeOptions,
  });
  const config = buildWorldAndSceneConfig();
  applyWorldModelPlugins(config, plugins);
  const container = document.querySelector(".canvas-container");
  if (!container) throw new Error("Required '.canvas-container' not found");
  bootstrapRendering({
    config,
    onFatalError: (failure) =>
      showFatalRenderError(container, runtimeOptions, failure),
    plugins,
  });
}

function showFatalRenderError(
  container: Element,
  runtimeOptions: ReturnType<typeof parseRuntimeOptionsFromSearch>,
  failure: RenderFailure,
): void {
  const messages = getRendererFailureMessages(
    resolveSolitudeLocale(runtimeOptions),
  );
  const message =
    failure.code === "webgl-context-lost"
      ? messages["renderer.failure.contextLost"]
      : failure.code === "webgl2-unavailable"
        ? messages["renderer.failure.unavailable"]
        : messages["renderer.failure.program"];
  showRenderFailurePanel({
    container,
    message,
    title: messages["renderer.failure.title"],
  });
}

void main().catch((error: unknown) => {
  console.error("Failed to start Solitude", error);
});
