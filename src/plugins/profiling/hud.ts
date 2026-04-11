import type { HudPlugin } from "../../app/pluginPorts";
import type { ProfilingController } from "./logic";

export function createHudPlugin(controller: ProfilingController): HudPlugin {
  return {
    updateHudParams: (params) => {
      if (!controller.isEnabled()) return;
      params.hudCells.push({ row: 2, col: 2, text: "PROFILING" });
    },
  };
}
