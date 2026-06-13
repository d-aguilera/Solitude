import type { HudPanelProvider } from "@solitude/sim/hud/provider";
import type { PlaybackController } from "./core";
import type { PlaybackLocalization } from "./localization";

export function createHudPanel(
  controller: PlaybackController,
  localization: PlaybackLocalization,
): HudPanelProvider {
  return {
    writeHud: (grid) => {
      const timeScale = controller.getEffectiveTimeScale();
      if (timeScale != null) {
        grid.addLine(
          "rightCenter",
          "runtime.timeScale",
          localization.timeScalePrefix.concat(timeScale.toString()),
        );
      }

      const text = controller.getStatusText();
      if (!text) return;
      grid.addLine("rightCenter", "playback.status", text);
    },
  };
}
