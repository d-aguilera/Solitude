import type { HudPlugin } from "../../app/pluginPorts";
import { vec3 } from "../../domain/vec3";
import { formatSpeed } from "../../render/formatters";

const speedPrefix = "Speed: ";
const thrustPrefix = "Thrust: ";
const rcsPrefix = "RCS: ";

export function createHudPlugin(): HudPlugin {
  return {
    updateHudParams: (
      grid,
      { currentRcsLevel, currentThrustLevel, mainShip },
    ) => {
      const speedMps = vec3.length(mainShip.velocity);
      grid[0][4] = speedPrefix.concat(formatSpeed(speedMps));

      const thrustPadding = currentThrustLevel < 0 ? "" : " ";
      grid[1][4] = thrustPrefix.concat(
        thrustPadding,
        currentThrustLevel.toString(),
      );

      const rcsPadding = currentRcsLevel < 0 ? "" : " ";
      grid[2][4] = rcsPrefix.concat(rcsPadding, currentRcsLevel.toFixed(2));
    },
  };
}
