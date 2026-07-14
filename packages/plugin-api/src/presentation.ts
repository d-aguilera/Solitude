import type { ExternalPluginCapabilityProvider } from "./capabilities";

export interface ExternalPresentationFrameContext {
  dtMillis: number;
  nowMs: number;
}

export interface ExternalPresentationFrameProvider {
  updatePresentationFrame: (context: ExternalPresentationFrameContext) => void;
}

export const presentationFrameCapability =
  "solitude.browser.presentationFrame.v1";

export function createPresentationFrameCapability(
  provider: ExternalPresentationFrameProvider,
): ExternalPluginCapabilityProvider {
  return { id: presentationFrameCapability, value: provider };
}

export function isPresentationFrameProvider(
  value: unknown,
): value is ExternalPresentationFrameProvider {
  const candidate = value as Partial<ExternalPresentationFrameProvider> | null;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.updatePresentationFrame === "function"
  );
}
