import type { GamePlugin } from "@solitude/engine/app/pluginPorts";
import { hudPanelCapability, isHudPanelProvider } from "./capabilities";

export function createHudPlugin(): GamePlugin {
  return {
    id: "hud",
    hud: ({ capabilityRegistry }) => {
      const providers = capabilityRegistry
        .getAll(hudPanelCapability)
        .filter(isHudPanelProvider);

      return {
        updateHudParams: (grid, context) => {
          for (const provider of providers) {
            provider.writeHud(grid, context);
          }
        },
      };
    },
  };
}
