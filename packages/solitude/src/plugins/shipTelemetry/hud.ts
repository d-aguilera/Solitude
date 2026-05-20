import { vec3 } from "@solitude/engine/math";
import { formatSpeed } from "@solitude/engine/render";
import type { HudPanelProvider } from "../hud/capabilities";
import type { SpacecraftOperatorTelemetry } from "../spacecraftOperator/telemetry";

const speedPrefix = "Speed: ";
const thrustPrefix = "Thrust: ";
const rcsPrefix = "RCS: ";

export function createHudPanel(
  telemetry: SpacecraftOperatorTelemetry,
): HudPanelProvider {
  return {
    writeHud: (grid, context) => {
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
