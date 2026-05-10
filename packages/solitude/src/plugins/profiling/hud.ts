import type { HudPanelProvider } from "../hud/capabilities";
import type { ProfilingController } from "./logic";

const profilingText = "PROFILING";

export function createHudPlugin(
  controller: ProfilingController,
): HudPanelProvider {
  return createHudPanel(controller);
}

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
