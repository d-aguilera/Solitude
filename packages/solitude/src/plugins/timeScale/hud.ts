import type { HudPlugin } from "@solitude/engine/app/pluginPorts";
import type { TimeScaleController } from "./logic";

const timeScalePrefix = "Time Scale: x";

export function createHudPlugin(controller: TimeScaleController): HudPlugin {
  return {
    updateHudParams: (grid) => {
      const scale = controller.getScale();
      if (scale === 1) return;
      grid[3][3] = timeScalePrefix.concat(scale.toString());
    },
  };
}
