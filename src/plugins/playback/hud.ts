import type { HudPlugin } from "../../app/pluginPorts";
import type { PlaybackController } from "./core";

const timeScalePrefix = "Time Scale: x";

export function createHudPlugin(controller: PlaybackController): HudPlugin {
  return {
    updateHudParams: (grid) => {
      const timeScale = controller.getEffectiveTimeScale();
      if (timeScale != null) {
        grid[3][3] = timeScalePrefix.concat(timeScale.toString());
      }

      const text = controller.getStatusText();
      if (!text) return;
      grid[4][3] = text;
    },
  };
}
