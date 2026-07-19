import type { ExternalHudPanelProvider } from "@solitude/plugin-api/hud";
import type { MemoryTelemetryController } from "./logic";

export function createHudPanel(
  controller: MemoryTelemetryController,
): ExternalHudPanelProvider {
  return {
    writeHud: (grid) => {
      if (!controller.isEnabled()) return;
      grid.addLine("center", "memory.heap", controller.getHudText());
    },
  };
}
