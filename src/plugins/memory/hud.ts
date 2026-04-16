import type { HudCell } from "../../app/hudPorts";
import type { HudPlugin } from "../../app/pluginPorts";
import type { MemoryTelemetryController } from "./logic";

const memoryHudCell: HudCell = {
  row: 4,
  col: 3,
  text: "",
};

export function createHudPlugin(
  controller: MemoryTelemetryController,
): HudPlugin {
  return {
    updateHudParams: (params) => {
      if (!controller.isEnabled()) return;
      memoryHudCell.text = controller.getHudText();
      params.hudCells.push(memoryHudCell);
    },
  };
}
