import { formatSimTime } from "@solitude/engine/render";
import type { HudPanelProvider } from "@solitude/hud/provider";
import type { RuntimeTelemetryLocalization } from "./localization";
import type { RuntimeTelemetryController } from "./logic";

export function createHudPanel(
  controller: RuntimeTelemetryController,
  localization: RuntimeTelemetryLocalization,
): HudPanelProvider {
  return {
    writeHud: (grid, context) => {
      grid.addLine(
        "center",
        "runtime.time",
        localization.timePrefix.concat(
          formatSimTime(context.simTimeMillis / 1000),
        ),
      );
      grid.addLine(
        "center",
        "runtime.fps",
        localization.fpsPrefix.concat(
          localization.formatFixed(controller.getFps(), 1),
        ),
      );
    },
  };
}
