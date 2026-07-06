import { createHudOverlayPlugin } from "@solitude/browser/dom/hudOverlayPlugin";
import {
  collectBrowserOverlayProviders,
  type BrowserOverlayProvider,
} from "@solitude/browser/dom/overlayPorts";
import { displayPluginCatalog } from "@solitude/display/plugins/catalog";
import {
  loadPlugins,
  type GamePlugin,
  type PluginCapabilityRegistry,
  type PluginCatalog,
  type RuntimeOptions,
} from "@solitude/engine/plugin";
import { createPluginCapabilityRegistry } from "@solitude/engine/runtime";
import {
  collectLocalEntityPredictionProviders,
  type LocalEntityPredictionProvider,
} from "@solitude/sim/localPrediction";
import { createAutopilotPlugin } from "@solitude/sim/plugins/autopilot";
import { createAutopilotInputPlugin } from "@solitude/sim/plugins/autopilot/input";
import { createSolarSystemPlugin } from "@solitude/sim/plugins/solarSystem";
import { createSpacecraftOperatorPlugin } from "@solitude/sim/plugins/spacecraftOperator";

export const remoteRenderPluginIds = [
  "solarSystem",
  "spacecraftOperator",
  "orbitSegments",
  "solarSystemMaterials",
  "orbitTelemetry",
  "shipTelemetry",
  "autopilot",
  "autopilotInput",
  "autopilotHud",
  "bodyLabels",
  "axialViews",
  "targetingLaser",
  "trajectories",
  "velocitySegments",
];

export const remoteRenderPluginCatalog: PluginCatalog = {
  ...displayPluginCatalog,
  autopilot: createAutopilotPlugin,
  autopilotInput: createAutopilotInputPlugin,
  solarSystem: createSolarSystemPlugin,
  spacecraftOperator: createSpacecraftOperatorPlugin,
};

export interface RemoteClientCompositionParams {
  clientPlugins: readonly GamePlugin[];
  runtimeOptions: RuntimeOptions;
}

export interface RemoteClientComposition {
  capabilityRegistry: PluginCapabilityRegistry;
  localPredictionProviders: readonly LocalEntityPredictionProvider[];
  overlayProviders: readonly BrowserOverlayProvider[];
  plugins: GamePlugin[];
}

export function createRemoteClientComposition({
  clientPlugins,
  runtimeOptions,
}: RemoteClientCompositionParams): RemoteClientComposition {
  const plugins = loadPlugins({
    catalog: {
      ...remoteRenderPluginCatalog,
      hud: createHudOverlayPlugin,
    },
    ids: ["hud", ...remoteRenderPluginIds],
    runtimeOptions,
  }).concat(clientPlugins);
  const capabilityRegistry = createPluginCapabilityRegistry(plugins);

  return {
    capabilityRegistry,
    localPredictionProviders:
      collectLocalEntityPredictionProviders(capabilityRegistry),
    overlayProviders: collectBrowserOverlayProviders(capabilityRegistry),
    plugins,
  };
}
