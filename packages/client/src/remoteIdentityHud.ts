import type { GamePlugin } from "@solitude/engine/plugin";
import { createHudPanelProvider } from "@solitude/sim/hud/provider";

export interface RemoteIdentityHudOptions {
  getEntityId: () => string;
  getGameId: () => string;
}

export function createRemoteIdentityHudPlugin({
  getEntityId,
  getGameId,
}: RemoteIdentityHudOptions): GamePlugin {
  return {
    id: "remoteIdentityHud",
    capabilities: [
      createHudPanelProvider({
        writeHud: (grid) => {
          const gameId = getGameId();
          const entityId = getEntityId();
          grid[3][0] = gameId.length > 0 ? `Game: ${gameId}` : "Game: none";
          grid[4][0] =
            entityId.length > 0 ? `Entity: ${entityId}` : "Entity: none";
        },
      }),
    ],
  };
}
