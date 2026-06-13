import type { HudPanelProvider } from "@solitude/sim/hud/provider";
import type { TimeScaleLocalization } from "./localization";
import type { TimeScaleController } from "./logic";

export function createHudPanel(
  controller: TimeScaleController,
  localization: TimeScaleLocalization,
): HudPanelProvider {
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
