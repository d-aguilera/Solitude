import type { ExternalHudPanelProvider } from "@solitude/plugin-api/hud";
import type { TimeScaleLocalization } from "./localization";
import type { TimeScaleController } from "./logic";

export function createHudPanel(
  controller: TimeScaleController,
  localization: TimeScaleLocalization,
): ExternalHudPanelProvider {
  return {
    writeHud: (grid) => {
      const scale = controller.getScale();
      if (scale === 1) return;
      grid.addLine(
        "rightCenter",
        "runtime.timeScale",
        localization.timeScalePrefix.concat(scale.toString()),
      );
    },
  };
}
