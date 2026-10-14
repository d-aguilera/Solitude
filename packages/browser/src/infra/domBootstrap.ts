import type { GamePlugin } from "@solitude/engine/plugin";
import type { ViewDefinition } from "@solitude/engine/render";
import { buildViewDefinitions } from "@solitude/engine/render";
import { createPluginCapabilityRegistry } from "@solitude/engine/runtime";
import type { WorldAndSceneConfig } from "@solitude/engine/world";
import { createDisposalScope } from "./disposal";
import { runLoop } from "./domGameLoop";
import {
  createInputDispatcher,
  type BrowserKeyboardHost,
} from "./domKeyboardInput";
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
export interface BrowserRuntimeHandle {
  clearInput: () => void;
  dispose: () => void;
}

export function bootstrapWith(
  config: WorldAndSceneConfig,
  plugins: GamePlugin[],
  onFatalError: (failure: RenderFailure) => void,
  keyboardHost: BrowserKeyboardHost,
): BrowserRuntimeHandle {
  const scope = createDisposalScope();
  try {
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
      (failure) => {
        if (scope.disposed) return;
        scope.dispose();
        onFatalError(failure);
      },
      textureSources,
      scope,
    );
    scope.add(initLayout(container, views));
    const dispatcher = createInputDispatcher(plugins);
    const pageHide = () => scope.dispose();
    window.addEventListener("pagehide", pageHide);
    scope.add(() => window.removeEventListener("pagehide", pageHide));
    const loop = runLoop({
      config,
      onError: (error) => {
        scope.dispose();
        throw error;
      },
      views,
      controlInput: dispatcher.controlInput,
      plugins,
    });
    scope.add(loop.dispose);
    // runLoop materializes and validates the pipeline synchronously; no keyboard
    // events or animation frames reach a rejected composition.
    const input = keyboardHost.attach(dispatcher);
    scope.add(input.dispose);
    return { clearInput: input.clear, dispose: scope.dispose };
  } catch (error) {
    scope.dispose();
    throw error;
  }
}

function createRunLoopViews(
  container: Element,
  definitions: ViewDefinition[],
  onFatalError: (failure: RenderFailure) => void,
  textureSources: RenderTextureSourceCatalog,
  scope: ReturnType<typeof createDisposalScope>,
): (RunLoopView & LayoutView)[] {
  const views: (RunLoopView & LayoutView)[] = [];
  scope.add(() => {
    views.length = 0;
  });
  let index = 0;
  for (const definition of primaryDefinitionsFirst(definitions)) {
    const layers = getOrCreateDomViewLayers(container, index, definition);
    scope.add(() => layers.element.remove());
    const presenter = createBrowserViewPresenter({
      labelMode: definition.labelMode,
      onFatalError,
      overlayCanvas: layers.overlayCanvas,
      sceneCanvas: layers.sceneCanvas,
      textureSources,
    });
    scope.add(presenter.dispose);
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
