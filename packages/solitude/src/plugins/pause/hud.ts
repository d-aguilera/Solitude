import type { HudPlugin } from "@solitude/engine/app/pluginPorts";
import type { PauseController } from "./logic";

const pausedText = "PAUSED";

export function createHudPlugin(controller: PauseController): HudPlugin {
  return {
    updateHudParams: (grid) => {
      if (!controller.isPaused()) return;
      grid[2][1] = pausedText;
    },
  };
}
