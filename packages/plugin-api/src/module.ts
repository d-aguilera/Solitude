import type { ExternalPluginCapabilityProvider } from "./capabilities";
import type { ExternalRuntimeOptions } from "./runtime";
import type {
  ExternalMarkerPlugin,
  ExternalSceneLabelPlugin,
  ExternalScenePlugin,
  ExternalSegmentPlugin,
} from "./scene";
import type { ExternalViewControlPlugin, ExternalViewPlugin } from "./views";

export type ExternalFocusCapabilityRequirement =
  | "angularVelocity"
  | "collisionSphere"
  | "controlledBody"
  | "gravityMass"
  | "lightEmitter"
  | "localFrame"
  | "motionState";

export interface ExternalPluginRequirements {
  mainFocus?: readonly ExternalFocusCapabilityRequirement[];
}

export interface ExternalPlugin {
  capabilities?: readonly ExternalPluginCapabilityProvider[];
  id: string;
  labels?: ExternalSceneLabelPlugin;
  markers?: ExternalMarkerPlugin;
  requirements?: ExternalPluginRequirements;
  scene?: ExternalScenePlugin;
  segments?: ExternalSegmentPlugin;
  viewControls?: ExternalViewControlPlugin;
  views?: ExternalViewPlugin;
}

export type ExternalPluginFactory = (
  runtimeOptions: ExternalRuntimeOptions,
) => ExternalPlugin;

export interface ExternalPluginModule {
  createPlugin: ExternalPluginFactory;
}
