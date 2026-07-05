import type { GamePlugin } from "@solitude/engine/plugin";
import type { ViewDefinition } from "@solitude/engine/render";
import { buildViewDefinitions } from "@solitude/engine/render";
import {
  createPluginCapabilityRegistry,
  NewtonianGravityEngine,
  parameters,
} from "@solitude/engine/runtime";
import type {
  GravityEngine,
  WorldAndSceneConfig,
} from "@solitude/engine/world";
import { runLoop } from "./domGameLoop";
import { initInput } from "./domKeyboardInput";
import { initLayout, type LayoutView } from "./domLayout";
import { getOrCreateDomViewLayers } from "./domView";
import type { RunLoopView } from "./infraPorts";
import type { RenderFailure } from "./renderFailure";
import {
  collectRenderTextureSources,
  type RenderTextureSourceCatalog,
} from "./renderTextureSources";
import { createBrowserViewPresenter } from "./viewPresenter";

/**
 * DOM-level bootstrap
 */
export function bootstrapWith(
  config: WorldAndSceneConfig,
  plugins: GamePlugin[],
  onFatalError: (failure: RenderFailure) => void,
): void {
  const textureSources = collectRenderTextureSources(
    createPluginCapabilityRegistry(plugins),
  );
  const container = document.querySelector(".canvas-container");
  if (!container) {
    throw new Error("Required '.canvas-container' not found in document");
  }

  const viewDefinitions = buildViewDefinitions(config, plugins);
  const views = createRunLoopViews(
    container,
    viewDefinitions,
    onFatalError,
    textureSources,
  );
  initLayout(container, views);
  window.addEventListener(
    "pagehide",
    () => {
      for (const view of views) view.dispose();
    },
    { once: true },
  );

  const gravityEngine: GravityEngine = new NewtonianGravityEngine(
    parameters.newtonG,
    parameters.softeningLength,
  );

  const { controlInput } = initInput(plugins);

  runLoop({
    config,
    views,
    gravityEngine,
    controlInput,
    plugins,
  });
}

function createRunLoopViews(
  container: Element,
  definitions: ViewDefinition[],
  onFatalError: (failure: RenderFailure) => void,
  textureSources: RenderTextureSourceCatalog,
): (RunLoopView & LayoutView)[] {
  const views: (RunLoopView & LayoutView)[] = [];
  let index = 0;
  for (const definition of primaryDefinitionsFirst(definitions)) {
    const layers = getOrCreateDomViewLayers(container, index, definition);
    const presenter = createBrowserViewPresenter({
      labelMode: definition.labelMode,
      onFatalError,
      overlayCanvas: layers.overlayCanvas,
      sceneCanvas: layers.sceneCanvas,
      textureSources,
    });
    views.push({
      definition,
      dispose: presenter.dispose,
      element: layers.element,
      layout: definition.layout,
      overlayRasterizer: presenter.overlayRasterizer,
      sceneOverlayRasterizer: presenter.sceneOverlayRasterizer,
      renderer: presenter,
      resize: presenter.resize,
      surface: presenter.surface,
    });
    index++;
  }
  return views;
}

function primaryDefinitionsFirst(
  definitions: ViewDefinition[],
): ViewDefinition[] {
  const ordered: ViewDefinition[] = [];
  for (const definition of definitions) {
    if (definition.layout.kind === "primary") ordered.push(definition);
  }
  for (const definition of definitions) {
    if (definition.layout.kind !== "primary") ordered.push(definition);
  }
  return ordered;
}
