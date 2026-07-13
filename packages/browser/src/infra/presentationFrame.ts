import type { PluginCapabilityRegistry } from "@solitude/engine/plugin";

export const presentationFrameCapability =
  "solitude.browser.presentationFrame.v1";

export interface PresentationFrameContext {
  dtMillis: number;
  nowMs: number;
}

export interface PresentationFrameProvider {
  updatePresentationFrame: (context: PresentationFrameContext) => void;
}

export function collectPresentationFrameProviders(
  capabilityRegistry: PluginCapabilityRegistry,
): PresentationFrameProvider[] {
  return capabilityRegistry
    .getAll(presentationFrameCapability)
    .filter(isPresentationFrameProvider);
}

export function updatePresentationFrameProviders(
  providers: readonly PresentationFrameProvider[],
  context: PresentationFrameContext,
): void {
  for (const provider of providers) {
    provider.updatePresentationFrame(context);
  }
}

function isPresentationFrameProvider(
  value: unknown,
): value is PresentationFrameProvider {
  return (
    typeof value === "object" &&
    value !== null &&
    "updatePresentationFrame" in value &&
    typeof value.updatePresentationFrame === "function"
  );
}
