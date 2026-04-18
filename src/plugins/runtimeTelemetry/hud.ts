import type { HudPlugin } from "../../app/pluginPorts";
import { formatSimTime } from "../../render/formatters";

const fpsPrefix = "FPS: ";
const timePrefix = "Time: ";

export function createHudPlugin(): HudPlugin {
  return {
    updateHudParams: (grid, { fps, simTimeMillis }) => {
      grid[3][4] = timePrefix.concat(formatSimTime(simTimeMillis / 1000));
      grid[4][4] = fpsPrefix.concat(fps.toFixed(1));
    },
  };
}
