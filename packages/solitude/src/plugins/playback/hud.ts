import type { HudPanelProvider } from "@solitude/sim/hud/provider";
import { type SolitudeLocalization } from "@solitude/sim/localization";
import type { PlaybackController } from "./core";

export function createHudPanel(
  controller: PlaybackController,
  localization: SolitudeLocalization,
): HudPanelProvider {
  const { hud } = localization;
  return {
    writeHud: (grid) => {
      const timeScale = controller.getEffectiveTimeScale();
      if (timeScale != null) {
        grid[3][3] = hud.timeScalePrefix.concat(timeScale.toString());
      }

      const text = controller.getStatusText();
      if (!text) return;
      grid[4][3] = text;
    },
  };
}
