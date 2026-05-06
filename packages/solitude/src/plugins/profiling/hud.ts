import type { HudPlugin } from "@solitude/engine/app/pluginPorts";
import type { ProfilingController } from "./logic";

const profilingText = "PROFILING";

export function createHudPlugin(controller: ProfilingController): HudPlugin {
  return {
    updateHudParams: (grid) => {
      if (!controller.isEnabled()) return;
      grid[2][2] = profilingText;
    },
  };
}
