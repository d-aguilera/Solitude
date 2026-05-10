import type { HudPanelProvider } from "../hud/capabilities";
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
