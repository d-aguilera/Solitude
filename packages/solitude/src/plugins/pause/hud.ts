import type { HudPanelProvider } from "@solitude/sim/hud/provider";
import type { SolitudeLocalization } from "@solitude/sim/localization";
import type { PauseController } from "./logic";

export function createHudPanel(
  controller: PauseController,
  localization: SolitudeLocalization,
): HudPanelProvider {
  const { hud } = localization;
  return {
    writeHud: (grid) => {
      if (!controller.isPaused()) return;
      grid.appendLine("center", "runtime.status", hud.paused);
    },
  };
}
