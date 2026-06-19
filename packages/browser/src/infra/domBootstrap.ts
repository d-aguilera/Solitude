import type { GamePlugin } from "@solitude/engine/plugin";
import type { ViewDefinition } from "@solitude/engine/render";
import { buildViewDefinitions } from "@solitude/engine/render";
import { NewtonianGravityEngine, parameters } from "@solitude/engine/runtime";
import type {
  GravityEngine,
  WorldAndSceneConfig,
} from "@solitude/engine/world";
import { runLoop } from "./domGameLoop";
import { initInput } from "./domKeyboardInput";
import { initLayout, type LayoutView } from "./domLayout";
import { getOrCreateDomViewLayers } from "./domView";
import type { RunLoopView } from "./infraPorts";
import type { RenderFailure, RendererBackend } from "./rendererBackend";
import { createBrowserViewPresenter } from "./viewPresenter";

/**
 * DOM-level bootstrap
 */
export function bootstrapWith(
  config: WorldAndSceneConfig,
  plugins: GamePlugin[],
  backend: RendererBackend,
  onFatalError: (failure: RenderFailure) => void,
): void {
  const container = document.querySelector(".canvas-container");
  if (!container) {
    throw new Error("Required '.canvas-container' not found in document");
  }

  const viewDefinitions = buildViewDefinitions(config, plugins);
  const views = createRunLoopViews(
    container,
    viewDefinitions,
    backend,
    onFatalError,
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
  backend: RendererBackend,
  onFatalError: (failure: RenderFailure) => void,
): (RunLoopView & LayoutView)[] {
  const views: (RunLoopView & LayoutView)[] = [];
  let index = 0;
  for (const definition of primaryDefinitionsFirst(definitions)) {
    const layers = getOrCreateDomViewLayers(container, index, definition);
    const presenter = createBrowserViewPresenter({
      backend,
      labelMode: definition.labelMode,
      onFatalError,
      overlayCanvas: layers.overlayCanvas,
      sceneCanvas: layers.sceneCanvas,
    });
    views.push({
      backend: presenter.backend,
      definition,
      dispose: presenter.dispose,
      element: layers.element,
      layout: definition.layout,
      overlayRasterizer: presenter.overlayRasterizer,
      rasterizer: presenter.rasterizer,
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
