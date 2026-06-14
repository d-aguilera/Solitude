import type { HudPanelProvider } from "@solitude/hud/provider";
import type { MemoryTelemetryController } from "./logic";

export function createHudPanel(
  controller: MemoryTelemetryController,
): HudPanelProvider {
  return {
    writeHud: (grid) => {
      if (!controller.isEnabled()) return;
      grid.addLine("center", "memory.heap", controller.getHudText());
    },
  };
}
