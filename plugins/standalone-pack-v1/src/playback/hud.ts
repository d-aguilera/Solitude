import type { ExternalHudPanelProvider } from "@solitude/plugin-api/hud";
import type { PlaybackController } from "./core";
import type { PlaybackLocalization } from "./localization";

export function createHudPanel(
  controller: PlaybackController,
  localization: PlaybackLocalization,
): ExternalHudPanelProvider {
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
