import type { HudPlugin } from "../../app/pluginPorts";
import type { TimeScaleController } from "./logic";

export function createHudPlugin(controller: TimeScaleController): HudPlugin {
  return {
    updateHudParams: (params) => {
      const scale = controller.getScale();
      if (scale === 1) return;
      params.hudCells.push({
        row: 3,
        col: 3,
        text: "Time Scale: x".concat(scale.toString()),
      });
    },
  };
}
