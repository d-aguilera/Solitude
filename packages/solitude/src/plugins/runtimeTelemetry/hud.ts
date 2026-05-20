import { formatSimTime } from "@solitude/engine/render";
import type { HudPanelProvider } from "../hud/capabilities";
import type { RuntimeTelemetryController } from "./logic";

const fpsPrefix = "FPS: ";
const timePrefix = "Time: ";

export function createHudPanel(
  controller: RuntimeTelemetryController,
): HudPanelProvider {
  return {
    writeHud: (grid, context) => {
      grid[3][4] = timePrefix.concat(
        formatSimTime(context.simTimeMillis / 1000),
      );
      grid[4][4] = fpsPrefix.concat(controller.getFps().toFixed(1));
    },
  };
}
