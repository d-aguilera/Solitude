import {
  createHudPanelCapability,
  isMultiplayerSessionProvider,
  multiplayerSessionCapability,
} from "@solitude/plugin-api/capabilities";
import { readLocaleRuntimeOption } from "@solitude/plugin-api/localization";
import type {
  ExternalMultiplayerSessionProvider,
  ExternalPlugin,
  ExternalPluginCapabilityRegistry,
  ExternalRuntimeOptions,
} from "@solitude/plugin-api/plugin";
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
