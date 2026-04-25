import type { HudPlugin } from "../../app/pluginPorts";
import { formatSimTime } from "../../render/formatters";
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
