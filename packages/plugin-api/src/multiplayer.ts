import type { ExternalPluginCapabilityProvider } from "./capabilities";

export interface ExternalMultiplayerSessionProvider {
  getEntityId: () => string;
  getGameId: () => string;
}

export const multiplayerSessionCapability = "solitude.multiplayer.session.v1";

export function createMultiplayerSessionCapability(
  provider: ExternalMultiplayerSessionProvider,
): ExternalPluginCapabilityProvider {
  return { id: multiplayerSessionCapability, value: provider };
}

export function isMultiplayerSessionProvider(
  value: unknown,
): value is ExternalMultiplayerSessionProvider {
  const candidate = value as Partial<ExternalMultiplayerSessionProvider> | null;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.getEntityId === "function" &&
    typeof candidate.getGameId === "function"
  );
}
