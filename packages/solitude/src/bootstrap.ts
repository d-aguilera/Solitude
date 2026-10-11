import { createBrowserKeyboardHost } from "@solitude/browser/dom/keyboardInput";
import type { RenderFailure } from "@solitude/browser/dom/renderFailure";
import { bootstrapRendering } from "@solitude/browser/dom/renderingBootstrap";
import { parseRuntimeOptionsFromSearch } from "@solitude/browser/dom/runtimeOptions";
import { buildWorldAndSceneConfig } from "@solitude/composition/config/worldAndSceneConfig";
import { loadPlugins } from "@solitude/engine/plugin";
import { createPluginCapabilityRegistry } from "@solitude/engine/runtime";
import { applyWorldModelPlugins } from "@solitude/engine/world";
import {
  createRuntimeOptionsWithResolvedLocale,
  resolveSolitudeLocale,
} from "@solitude/localization";
import {
  adventureGuidanceCapability,
  isAdventureGuidanceProvider,
  isStandaloneSession,
  standaloneSessionCapability,
} from "@solitude/plugin-api/standalone-session";
import {
  appendExternalPluginSet,
  loadBrowserPlugins,
} from "@solitude/plugin-runtime";
import { getRendererFailureMessages } from "./rendererFailureLocalization";
import { createStandalonePresentation } from "./standalonePresentation";
import {
  createRunOptions,
  menuUrl,
  resolveStandaloneEntry,
} from "./standaloneSelection";
import { createStandaloneShell } from "./standaloneShell";
import { staticPluginCatalog, staticPluginIds } from "./staticPluginCatalog";

class RenderStartupError extends Error {}

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
    staticPluginCatalog,
    staticPluginIds,
    externalPlugins,
  );
  const createPlugins = (options: typeof runtimeOptions, ids = pluginSet.ids) =>
    loadPlugins({ catalog: pluginSet.catalog, ids, runtimeOptions: options });
  const getSession = (plugins: ReturnType<typeof createPlugins>) => {
    const sessions = createPluginCapabilityRegistry(plugins)
      .getAll(standaloneSessionCapability)
      .filter(isStandaloneSession);
    if (sessions.length !== 1)
      throw new Error("Standalone requires one session capability");
    return sessions[0];
  };
  // Menu content comes from the pack without constructing a world or a run.
  const menuSession = getSession(
    createPlugins(createRunOptions(runtimeOptions, "free-flight", 0), [
      "standaloneSession",
    ]),
  );
  const container = document.querySelector(".canvas-container");
  if (!container) throw new Error("Required '.canvas-container' not found");
  const keyboardHost = createBrowserKeyboardHost();
  let launchOptions = runtimeOptions;
  const shell = createStandaloneShell({
    createRun: (mode, generation) => {
      const options = createRunOptions(launchOptions, mode, generation);
      const plugins = createPlugins(options);
      const session = getSession(plugins);
      const providers = createPluginCapabilityRegistry(plugins).getAll(
        adventureGuidanceCapability,
      );
      let guidance = null;
      if (mode === "my-first-orbit") {
        if (
          providers.length !== 1 ||
          !isAdventureGuidanceProvider(providers[0]) ||
          providers[0].guidance.generation !== generation
        )
          throw new Error("Adventure requires one matching guidance provider");
        guidance = providers[0].guidance;
      }
      const config = buildWorldAndSceneConfig();
      applyWorldModelPlugins(config, plugins);
      const runtime = bootstrapRendering({
        config,
        keyboardHost,
        plugins,
        onFatalError: (failure) =>
          shell.fail(
            generation,
            new RenderStartupError(getFatalRenderMessage(options, failure)),
          ),
      });
      return { ...runtime, session, guidance };
    },
    showRun: (session, guidance) => presentation.showRun(session, guidance),
    hideRun: () => presentation.clearRun(),
    showMenu: () => presentation.showMenu(),
    showError: (error) => {
      console.error("Failed to start flight", error);
      presentation.showError(
        error instanceof RenderStartupError
          ? error.message
          : menuSession.labels.startupError,
      );
    },
    resetUrl: () => {
      launchOptions = { locale: runtimeOptions.locale ?? "en" };
      window.history.replaceState(null, "", menuUrl(window.location.href));
    },
    defer: queueMicrotask,
  });
  const presentation = createStandalonePresentation(
    container,
    menuSession.labels,
    shell.launch,
    shell.menu,
  );
  const entry = resolveStandaloneEntry(runtimeOptions);
  if (entry.kind === "run") shell.launch(entry.mode);
  else if (entry.kind === "error")
    presentation.showError(menuSession.labels.selectionError);
  else presentation.showMenu();
  const dispose = () => {
    shell.dispose();
    keyboardHost.dispose();
    presentation.dispose();
    window.removeEventListener("pagehide", dispose);
  };
  window.addEventListener("pagehide", dispose);
}

function getFatalRenderMessage(
  runtimeOptions: ReturnType<typeof parseRuntimeOptionsFromSearch>,
  failure: RenderFailure,
): string {
  const messages = getRendererFailureMessages(
    resolveSolitudeLocale(runtimeOptions),
  );
  const message =
    failure.code === "webgl-context-lost"
      ? messages["renderer.failure.contextLost"]
      : failure.code === "webgl2-unavailable"
        ? messages["renderer.failure.unavailable"]
        : messages["renderer.failure.program"];
  return message;
}

void main().catch((error: unknown) => {
  console.error("Failed to start Solitude", error);
});
