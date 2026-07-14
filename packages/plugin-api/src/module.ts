import type { ExternalPluginCapabilityProvider } from "./capabilities";
import type { ExternalRuntimeOptions } from "./runtime";
import type {
  ExternalMarkerPlugin,
  ExternalSceneLabelPlugin,
  ExternalScenePlugin,
  ExternalSegmentPlugin,
} from "./scene";
import type { ExternalViewControlPlugin, ExternalViewPlugin } from "./views";

export type ExternalFocusEntityCapabilityRequirement =
  | "collisionSphere"
  | "gravityMass"
  | "lightEmitter";

export interface ExternalPluginRequirements {
  focusEntity?: readonly ExternalFocusEntityCapabilityRequirement[];
}

export interface ExternalPluginHooks {
  labels?: ExternalSceneLabelPlugin;
  markers?: ExternalMarkerPlugin;
  scene?: ExternalScenePlugin;
  segments?: ExternalSegmentPlugin;
  viewControls?: ExternalViewControlPlugin;
  views?: ExternalViewPlugin;
}

export interface ExternalPlugin {
  id: string;
  capabilities?: readonly ExternalPluginCapabilityProvider[];
  requirements?: ExternalPluginRequirements;
  hooks?: ExternalPluginHooks;
}

export type ExternalPluginFactory = (
  runtimeOptions: ExternalRuntimeOptions,
) => ExternalPlugin;

export interface ExternalPluginModule {
  createPlugin: ExternalPluginFactory;
}
