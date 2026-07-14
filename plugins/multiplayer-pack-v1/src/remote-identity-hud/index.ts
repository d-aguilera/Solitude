import type { ExternalPluginCapabilityRegistry } from "@solitude/plugin-api/capabilities";
import { createHudPanelCapability } from "@solitude/plugin-api/hud";
import { readLocaleRuntimeOption } from "@solitude/plugin-api/localization";
import type { ExternalPlugin } from "@solitude/plugin-api/module";
import type { ExternalMultiplayerSessionProvider } from "@solitude/plugin-api/multiplayer";
import {
  isMultiplayerSessionProvider,
  multiplayerSessionCapability,
} from "@solitude/plugin-api/multiplayer";
import type { ExternalRuntimeOptions } from "@solitude/plugin-api/runtime";
import { getRemoteIdentityMessages } from "./localization";

export function createPlugin(
  runtimeOptions: ExternalRuntimeOptions,
): ExternalPlugin {
  const messages = getRemoteIdentityMessages(
    readLocaleRuntimeOption(runtimeOptions),
  );
  return {
    id: "remoteIdentityHud",
    capabilities: [
      createHudPanelCapability({
        writeHud: (grid, context) => {
          const session = findMultiplayerSession(context.capabilityRegistry);
          const gameId = session?.getGameId() ?? "";
          const entityId = session?.getEntityId() ?? "";
          grid.addLine(
            "center",
            "remote.game",
            gameId.length > 0
              ? messages.gamePrefix.concat(gameId)
              : messages.gameNone,
          );
          grid.addLine(
            "center",
            "remote.entity",
            entityId.length > 0
              ? messages.entityPrefix.concat(entityId)
              : messages.entityNone,
          );
        },
      }),
    ],
  };
}

function findMultiplayerSession(
  capabilityRegistry: ExternalPluginCapabilityRegistry,
): ExternalMultiplayerSessionProvider | null {
  for (const value of capabilityRegistry.getAll(multiplayerSessionCapability)) {
    if (isMultiplayerSessionProvider(value)) return value;
  }
  return null;
}
