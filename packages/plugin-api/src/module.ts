import type { ExternalPluginCapabilityProvider } from "./capabilities";
import type { ExternalLoopPlugin } from "./loop";
import type { ExternalProfilerControl } from "./profiling";
import type { ExternalRuntimeOptions } from "./runtime";
import type {
  ExternalMarkerPlugin,
  ExternalSceneLabelPlugin,
  ExternalScenePlugin,
  ExternalSegmentPlugin,
} from "./scene";
import type { ExternalViewControlPlugin, ExternalViewPlugin } from "./views";
import type { ExternalWorldModelPlugin } from "./world-model";

export type ExternalFocusEntityCapabilityRequirement =
  "collisionSphere" | "gravityMass";

export interface ExternalPluginRequirements {
  focusEntity?: readonly ExternalFocusEntityCapabilityRequirement[];
}

export interface ExternalPluginHooks {
  labels?: ExternalSceneLabelPlugin;
  loop?: ExternalLoopPlugin;
  markers?: ExternalMarkerPlugin;
  scene?: ExternalScenePlugin;
  segments?: ExternalSegmentPlugin;
  viewControls?: ExternalViewControlPlugin;
  views?: ExternalViewPlugin;
  worldModel?: ExternalWorldModelPlugin;
}

export interface ExternalPlugin {
  id: string;
  capabilities?: readonly ExternalPluginCapabilityProvider[];
  requirements?: ExternalPluginRequirements;
  hooks?: ExternalPluginHooks;
}

export interface ExternalPluginContext {
  readonly profiler: ExternalProfilerControl;
}

export type ExternalPluginFactory = (
  runtimeOptions: ExternalRuntimeOptions,
  context: ExternalPluginContext,
) => ExternalPlugin;

export interface ExternalPluginModule {
  createPlugin: ExternalPluginFactory;
}
