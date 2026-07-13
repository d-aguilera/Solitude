import type { GamePlugin } from "@solitude/engine/plugin";

export const multiplayerSessionCapability = "solitude.multiplayer.session.v1";

export interface MultiplayerSessionProvider {
  getEntityId: () => string;
  getGameId: () => string;
}

export function createMultiplayerSessionPlugin(
  provider: MultiplayerSessionProvider,
): GamePlugin {
  return {
    id: "multiplayerSession",
    capabilities: [{ id: multiplayerSessionCapability, value: provider }],
  };
}
