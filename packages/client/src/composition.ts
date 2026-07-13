import { createHudOverlayPlugin } from "@solitude/browser/dom/hudOverlayPlugin";
import {
  collectBrowserOverlayProviders,
  type BrowserOverlayProvider,
} from "@solitude/browser/dom/overlayPorts";
import {
  loadPlugins,
  type GamePlugin,
  type PluginCapabilityRegistry,
  type PluginCatalog,
  type RuntimeOptions,
} from "@solitude/engine/plugin";
import { createPluginCapabilityRegistry } from "@solitude/engine/runtime";
import { appendExternalPluginSet } from "@solitude/plugin-runtime";
import {
  collectLocalEntityPredictionProviders,
  type LocalEntityPredictionProvider,
} from "@solitude/sim/localPrediction";
import { simPluginCatalog } from "@solitude/sim/plugins/catalog";

export const remoteRenderPluginIds = [
  "solarSystem",
  "spacecraftOperator",
  "autopilot",
  "autopilotInput",
];

export const remoteRenderPluginCatalog: PluginCatalog = {
  ...simPluginCatalog,
};

export interface RemoteClientCompositionParams {
  clientPlugins: readonly GamePlugin[];
  externalPluginCatalog: PluginCatalog;
  externalPluginIds: readonly string[];
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
  externalPluginCatalog,
  externalPluginIds,
  runtimeOptions,
}: RemoteClientCompositionParams): RemoteClientComposition {
  const pluginSet = appendExternalPluginSet(
    {
      ...remoteRenderPluginCatalog,
      hud: createHudOverlayPlugin,
    },
    ["hud", ...remoteRenderPluginIds],
    {
      catalog: externalPluginCatalog,
      ids: externalPluginIds,
    },
  );
  const plugins = loadPlugins({
    catalog: pluginSet.catalog,
    ids: pluginSet.ids,
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
