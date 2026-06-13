import { formatSimTime } from "@solitude/engine/render";
import type { HudPanelProvider } from "@solitude/sim/hud/provider";
import { type SolitudeLocalization } from "@solitude/sim/localization";
import type { RuntimeTelemetryController } from "./logic";

export function createHudPanel(
  controller: RuntimeTelemetryController,
  localization: SolitudeLocalization,
): HudPanelProvider {
  const { hud } = localization;
  return {
    writeHud: (grid, context) => {
      grid.addLine(
        "center",
        "runtime.time",
        hud.timePrefix.concat(formatSimTime(context.simTimeMillis / 1000)),
      );
      grid.addLine(
        "center",
        "runtime.fps",
        hud.fpsPrefix.concat(localization.formatFixed(controller.getFps(), 1)),
      );
    },
  };
}
