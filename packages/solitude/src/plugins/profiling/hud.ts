import type { HudPanelProvider } from "@solitude/sim/hud/provider";
import type { ProfilingController } from "./logic";

const profilingText = "PROFILING";

export function createHudPanel(
  controller: ProfilingController,
): HudPanelProvider {
  return {
    writeHud: (grid) => {
      if (!controller.isEnabled()) return;
      grid[2][2] = profilingText;
    },
  };
}
