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

export interface ExternalPluginBase {
  id: string;
  capabilities?: readonly ExternalPluginCapabilityProvider[];
}

export interface ExternalBrowserPlugin extends ExternalPluginBase {
  requirements?: ExternalPluginRequirements;
  hooks?: ExternalPluginHooks;
}

export interface ExternalHostNeutralPlugin extends ExternalPluginBase {
  requirements?: never;
  hooks?: never;
}

export interface ExternalServerPlugin extends ExternalHostNeutralPlugin {}

export type ExternalPlugin = ExternalBrowserPlugin | ExternalServerPlugin;

export interface ExternalPluginContext {
  readonly profiler: ExternalProfilerControl;
}

export type ExternalPluginFactory<
  Plugin extends ExternalPlugin = ExternalPlugin,
> = (
  runtimeOptions: ExternalRuntimeOptions,
  context: ExternalPluginContext,
) => Plugin;

export type ExternalBrowserPluginFactory =
  ExternalPluginFactory<ExternalBrowserPlugin>;
export type ExternalServerPluginFactory =
  ExternalPluginFactory<ExternalServerPlugin>;

export interface ExternalPluginModule<
  Plugin extends ExternalPlugin = ExternalPlugin,
> {
  createPlugin: ExternalPluginFactory<Plugin>;
}
