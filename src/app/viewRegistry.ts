import { localFrame } from "../domain/localFrame";
import { vec3 } from "../domain/vec3";
import { createPrimaryViewDefinition } from "./cameras";
import type { WorldAndSceneConfig } from "./configPorts";
import type { GamePlugin, ViewPlugin, ViewRegistry } from "./pluginPorts";
import type { DomainCameraPose } from "./scenePorts";
import type { SceneViewState, ViewDefinition } from "./viewPorts";

export function buildViewDefinitions(
  config: WorldAndSceneConfig,
  plugins: GamePlugin[],
): ViewDefinition[] {
  const definitions: ViewDefinition[] = [
    createPrimaryViewDefinition(config.render.pilotCameraOffset),
  ];
  const registry: ViewRegistry = {
    addView: (view) => {
      definitions.push(view);
    },
  };

  for (const plugin of collectViewPlugins(plugins)) {
    plugin.registerViews(registry, { config });
  }

  return definitions;
}

export function createSceneViewStates(
  definitions: ViewDefinition[],
): SceneViewState[] {
  const views: SceneViewState[] = [];
  for (const definition of definitions) {
    views.push({
      definition,
      camera: createCameraPose(),
      cameraOffset: vec3.clone(definition.initialCameraOffset),
    });
  }
  return views;
}

export function getRequiredPrimaryViewState(
  views: SceneViewState[],
): SceneViewState {
  let primaryView: SceneViewState | null = null;
  for (const view of views) {
    if (view.definition.layout.kind !== "primary") continue;
    if (primaryView) {
      throw new Error("Multiple primary views registered");
    }
    primaryView = view;
  }
  if (!primaryView) {
    throw new Error("Required primary view not registered");
  }
  return primaryView;
}

function createCameraPose(): DomainCameraPose {
  return {
    position: vec3.zero(),
    frame: localFrame.zero(),
  };
}

function collectViewPlugins(plugins: GamePlugin[]): ViewPlugin[] {
  const viewPlugins: ViewPlugin[] = [];
  for (const plugin of plugins) {
    if (plugin.views) {
      viewPlugins.push(plugin.views);
    }
  }
  return viewPlugins;
}
