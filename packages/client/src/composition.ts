import { createHudOverlayPlugin } from "@solitude/browser/dom/hudOverlayPlugin";
import {
  collectBrowserOverlayProviders,
  type BrowserOverlayProvider,
} from "@solitude/browser/dom/overlayPorts";
import {
  remoteRenderPluginCatalog,
  remoteRenderPluginIds,
} from "@solitude/display/plugins/catalog";
import {
  loadPlugins,
  type GamePlugin,
  type PluginCapabilityRegistry,
  type RuntimeOptions,
} from "@solitude/engine/plugin";
import { createPluginCapabilityRegistry } from "@solitude/engine/runtime";
import {
  collectLocalEntityPredictionProviders,
  type LocalEntityPredictionProvider,
} from "@solitude/sim/localPrediction";

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
