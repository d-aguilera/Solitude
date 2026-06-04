import type { HudPanelProvider } from "@solitude/sim/hud/provider";
import type { MemoryTelemetryController } from "./logic";

export function createHudPanel(
  controller: MemoryTelemetryController,
): HudPanelProvider {
  return {
    writeHud: (grid) => {
      if (!controller.isEnabled()) return;
      grid[4][3] = controller.getHudText();
    },
  };
}
