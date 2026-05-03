import type { HudPlugin } from "../../app/pluginPorts";
import { vec3 } from "../../domain/vec3";
import { formatSpeed } from "../../render/formatters";
import type { SpacecraftOperatorTelemetry } from "../spacecraftOperator/telemetry";

const speedPrefix = "Speed: ";
const thrustPrefix = "Thrust: ";
const rcsPrefix = "RCS: ";

export function createHudPlugin(
  telemetry: SpacecraftOperatorTelemetry,
): HudPlugin {
  return {
    updateHudParams: (grid, context) => {
      const speedMps = vec3.length(context.mainFocus.controlledBody.velocity);
      grid[0][4] = speedPrefix.concat(formatSpeed(speedMps));

      const thrustPadding = telemetry.currentThrustLevel < 0 ? "" : " ";
      grid[1][4] = thrustPrefix.concat(
        thrustPadding,
        telemetry.currentThrustLevel.toString(),
      );

      const rcsPadding = telemetry.currentRcsLevel < 0 ? "" : " ";
      grid[2][4] = rcsPrefix.concat(
        rcsPadding,
        telemetry.currentRcsLevel.toFixed(2),
      );
    },
  };
}
