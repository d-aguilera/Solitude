import type { HudPanelProvider } from "@solitude/sim/hud/provider";
import { type SolitudeLocalization } from "@solitude/sim/localization";
import type { TimeScaleController } from "./logic";

export function createHudPanel(
  controller: TimeScaleController,
  localization: SolitudeLocalization,
): HudPanelProvider {
  const { hud } = localization;
  return {
    writeHud: (grid) => {
      const scale = controller.getScale();
      if (scale === 1) return;
      grid.addLine(
        "rightCenter",
        "runtime.timeScale",
        hud.timeScalePrefix.concat(scale.toString()),
      );
    },
  };
}
