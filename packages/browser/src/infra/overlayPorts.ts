import type { ControlInput } from "@solitude/engine/app/controlPorts";
import type {
  FramePolicy,
  PluginCapabilityProvider,
  PluginCapabilityRegistry,
} from "@solitude/engine/app/pluginPorts";
import type { FocusContext } from "@solitude/engine/app/runtimePorts";
import type { World } from "@solitude/engine/domain/domainPorts";
import type { Rasterizer } from "@solitude/engine/render/renderPorts";

export const browserOverlayCapability = "solitude.browser.overlay.v1";

export interface BrowserOverlayContext {
  advanceOverlay: boolean;
  controlInput: ControlInput;
  framePolicy: FramePolicy;
  mainFocus: FocusContext;
  nowMs: number;
  primaryRasterizer: Rasterizer;
  simTimeMillis: number;
  world: World;
}

export interface BrowserOverlayProvider {
  renderOverlay: (
    context: BrowserOverlayContext,
    capabilityRegistry: PluginCapabilityRegistry,
  ) => void;
}

export function createBrowserOverlayProvider(
  provider: BrowserOverlayProvider,
): PluginCapabilityProvider {
  return {
    id: browserOverlayCapability,
    value: provider,
  };
}
