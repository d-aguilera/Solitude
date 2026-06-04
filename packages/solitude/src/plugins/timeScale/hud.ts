import type { HudPanelProvider } from "@solitude/sim/hud/provider";
import type { TimeScaleController } from "./logic";

const timeScalePrefix = "Time Scale: x";

export function createHudPanel(
  controller: TimeScaleController,
): HudPanelProvider {
  return {
    writeHud: (grid) => {
      const scale = controller.getScale();
      if (scale === 1) return;
      grid[3][3] = timeScalePrefix.concat(scale.toString());
    },
  };
}
