import { createBrowserHudOverlayAdapter } from "@solitude/browser/dom/hudOverlayAdapter";
import {
  collectBrowserOverlayProviders,
  type BrowserOverlayProvider,
} from "@solitude/browser/dom/overlayPorts";
import {
  collectPresentationFrameProviders,
  type PresentationFrameProvider,
} from "@solitude/browser/dom/presentationFrame";
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
  type ExternalLocalEntityPredictionProvider as LocalEntityPredictionProvider,
} from "@solitude/plugin-api/local-prediction";
import { appendExternalPluginSet } from "@solitude/plugin-runtime";

export const remoteRenderPluginCatalog: PluginCatalog = {};

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
  presentationFrameProviders: readonly PresentationFrameProvider[];
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
      browserHudOverlay: createBrowserHudOverlayAdapter,
    },
    ["browserHudOverlay"],
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
    presentationFrameProviders:
      collectPresentationFrameProviders(capabilityRegistry),
    plugins,
  };
}
