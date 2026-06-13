import type { GamePlugin } from "@solitude/engine/plugin";
import { createHudPanelProvider } from "@solitude/sim/hud/provider";
import type { SolitudeLocalization } from "@solitude/sim/localization";

export interface RemoteIdentityHudOptions {
  getEntityId: () => string;
  getGameId: () => string;
  localization: SolitudeLocalization;
}

export function createRemoteIdentityHudPlugin({
  getEntityId,
  getGameId,
  localization,
}: RemoteIdentityHudOptions): GamePlugin {
  const { hud } = localization;
  return {
    id: "remoteIdentityHud",
    capabilities: [
      createHudPanelProvider({
        writeHud: (grid) => {
          const gameId = getGameId();
          const entityId = getEntityId();
          grid.addLine(
            "center",
            "remote.game",
            gameId.length > 0 ? hud.gamePrefix.concat(gameId) : hud.gameNone,
          );
          grid.addLine(
            "center",
            "remote.entity",
            entityId.length > 0
              ? hud.entityPrefix.concat(entityId)
              : hud.entityPrefix.concat(hud.none),
          );
        },
      }),
    ],
  };
}
