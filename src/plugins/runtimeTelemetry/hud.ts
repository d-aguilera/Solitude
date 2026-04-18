import type { HudPlugin } from "../../app/pluginPorts";
import { formatSimTime } from "../../render/formatters";

const fpsPrefix = "FPS: ";
const timePrefix = "Time: ";

export function createHudPlugin(): HudPlugin {
  return {
    updateHudParams: (grid, context) => {
      grid[3][4] = timePrefix.concat(
        formatSimTime(context.simTimeMillis / 1000),
      );
      grid[4][4] = fpsPrefix.concat(context.fps.toFixed(1));
    },
  };
}
