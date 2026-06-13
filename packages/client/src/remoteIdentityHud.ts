import type { GamePlugin } from "@solitude/engine/plugin";
import { createHudPanelProvider } from "@solitude/sim/hud/provider";
import type { ClientLocalization } from "./localization";

export interface RemoteIdentityHudOptions {
  getEntityId: () => string;
  getGameId: () => string;
  localization: ClientLocalization;
}

export function createRemoteIdentityHudPlugin({
  getEntityId,
  getGameId,
  localization,
}: RemoteIdentityHudOptions): GamePlugin {
  const { common, remoteIdentity } = localization;
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
            gameId.length > 0
              ? remoteIdentity.gamePrefix.concat(gameId)
              : remoteIdentity.gameNone,
          );
          grid.addLine(
            "center",
            "remote.entity",
            entityId.length > 0
              ? remoteIdentity.entityPrefix.concat(entityId)
              : remoteIdentity.entityPrefix.concat(common.none),
          );
        },
      }),
    ],
  };
}
