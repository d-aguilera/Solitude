import type { HudPlugin } from "../../app/pluginPorts";
import type { MemoryTelemetryController } from "./logic";

export function createHudPlugin(
  controller: MemoryTelemetryController,
): HudPlugin {
  return {
    updateHudParams: (grid) => {
      if (!controller.isEnabled()) return;
      grid[4][3] = controller.getHudText();
    },
  };
}
