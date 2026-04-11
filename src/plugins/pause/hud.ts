import type { HudPlugin } from "../../app/pluginPorts";
import type { PauseController } from "./logic";

export function createHudPlugin(controller: PauseController): HudPlugin {
  return {
    updateHudParams: (params) => {
      if (!controller.isPaused()) return;
      if (params.orbitReadout) {
        params.hudCells.push({ row: 2, col: 1, text: "PAUSED" });
      }
    },
  };
}
