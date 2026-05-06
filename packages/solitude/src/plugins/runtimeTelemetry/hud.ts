import type { HudPlugin } from "@solitude/engine/app/pluginPorts";
import { formatSimTime } from "@solitude/engine/render/formatters";
import type { RuntimeTelemetryController } from "./logic";

const fpsPrefix = "FPS: ";
const timePrefix = "Time: ";

export function createHudPlugin(
  controller: RuntimeTelemetryController,
): HudPlugin {
  return {
    updateHudParams: (grid, context) => {
      grid[3][4] = timePrefix.concat(
        formatSimTime(context.simTimeMillis / 1000),
      );
      grid[4][4] = fpsPrefix.concat(controller.getFps().toFixed(1));
    },
  };
}
