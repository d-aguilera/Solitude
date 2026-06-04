import type { HudPanelProvider } from "@solitude/sim/hud/provider";
import type { PlaybackController } from "./core";

const timeScalePrefix = "Time Scale: x";

export function createHudPanel(
  controller: PlaybackController,
): HudPanelProvider {
  return {
    writeHud: (grid) => {
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
