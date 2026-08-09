import type { ExternalPluginCapabilityProvider } from "./capabilities";
import type { ExternalControlPlugin } from "./controls";
import type { ExternalGravityProvider } from "./gravity";
import type { ExternalLoopPlugin } from "./loop";
import type { ExternalProfilerControl } from "./profiling";
import type { ExternalRuntimeOptions } from "./runtime";
import type {
  ExternalMarkerPlugin,
  ExternalSceneLabelPlugin,
  ExternalScenePlugin,
  ExternalSegmentPlugin,
} from "./scene";
import type {
  ExternalSimulationContribution,
  ExternalVehicleDynamicsContribution,
} from "./simulation";
import type { ExternalRuntimeSnapshotService } from "./snapshots";
import type { ExternalViewControlPlugin, ExternalViewPlugin } from "./views";
import type { ExternalWorldModelPlugin } from "./world-model";

export type ExternalFocusEntityCapabilityRequirement =
  "collisionSphere" | "gravityMass";

export interface ExternalPluginRequirements {
  focusEntity?: readonly ExternalFocusEntityCapabilityRequirement[];
}

export interface ExternalPluginHooks {
  controls?: ExternalControlPlugin;
  labels?: ExternalSceneLabelPlugin;
  loop?: ExternalLoopPlugin;
  markers?: ExternalMarkerPlugin;
  scene?: ExternalScenePlugin;
  segments?: ExternalSegmentPlugin;
  simulation?: ExternalSimulationContribution;
  viewControls?: ExternalViewControlPlugin;
  views?: ExternalViewPlugin;
  worldModel?: ExternalWorldModelPlugin;
}

export interface ExternalPluginBase {
  id: string;
  capabilities?: readonly ExternalPluginCapabilityProvider[];
  gravity?: ExternalGravityProvider;
}

export interface ExternalBrowserPlugin extends ExternalPluginBase {
  requirements?: ExternalPluginRequirements;
  hooks?: ExternalPluginHooks;
}

export interface ExternalServerPluginHooks {
  controls?: ExternalControlPlugin;
  labels?: never;
  loop?: never;
  markers?: never;
  scene?: never;
  segments?: never;
  simulation?: ExternalVehicleDynamicsContribution;
  viewControls?: never;
  views?: never;
  worldModel?: ExternalWorldModelPlugin;
}

export interface ExternalServerPlugin extends ExternalPluginBase {
  hooks?: ExternalServerPluginHooks;
  requirements?: never;
}

export interface ExternalHostNeutralPlugin extends ExternalPluginBase {
  requirements?: never;
  hooks?: never;
}

export type ExternalPlugin = ExternalBrowserPlugin | ExternalServerPlugin;

export interface ExternalPluginContext {
  readonly profiler: ExternalProfilerControl;
  readonly snapshots: ExternalRuntimeSnapshotService;
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
