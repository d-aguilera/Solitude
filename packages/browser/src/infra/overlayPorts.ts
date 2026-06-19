import type {
  ControlInput,
  FramePolicy,
  PluginCapabilityProvider,
  PluginCapabilityRegistry,
} from "@solitude/engine/plugin";
import type { FocusContext } from "@solitude/engine/runtime";
import type { World } from "@solitude/engine/world";

export const browserOverlayCapability = "solitude.browser.overlay.v1";

export interface OverlayRasterizer {
  beginFrame: () => void;
  drawHud: (hud: unknown) => void;
}

export interface BrowserOverlayContext {
  advanceOverlay: boolean;
  controlInput: ControlInput;
  framePolicy: FramePolicy;
  mainFocus: FocusContext;
  nowMs: number;
  primaryOverlayRasterizer: OverlayRasterizer | null;
  simTimeMillis: number;
  world: World;
}

export interface BrowserOverlayProvider {
  renderOverlay: (
    context: BrowserOverlayContext,
    capabilityRegistry: PluginCapabilityRegistry,
  ) => void;
}

export function createPluginCapabilityProvider(
  provider: BrowserOverlayProvider,
): PluginCapabilityProvider {
  return {
    id: browserOverlayCapability,
    value: provider,
  };
}

export function collectBrowserOverlayProviders(
  capabilityRegistry: PluginCapabilityRegistry,
): BrowserOverlayProvider[] {
  return capabilityRegistry
    .getAll(browserOverlayCapability)
    .filter(isBrowserOverlayProvider);
}

export function applyBrowserOverlayProviders(
  providers: readonly BrowserOverlayProvider[],
  context: BrowserOverlayContext,
  capabilityRegistry: PluginCapabilityRegistry,
): void {
  for (const provider of providers) {
    provider.renderOverlay(context, capabilityRegistry);
  }
}

function isBrowserOverlayProvider(
  value: unknown,
): value is BrowserOverlayProvider {
  return (
    typeof value === "object" &&
    value !== null &&
    "renderOverlay" in value &&
    typeof value.renderOverlay === "function"
  );
}
