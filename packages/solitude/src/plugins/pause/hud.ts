import type { HudPanelProvider } from "@solitude/hud/provider";
import type { PauseLocalization } from "./localization";
import type { PauseController } from "./logic";

export function createHudPanel(
  controller: PauseController,
  localization: PauseLocalization,
): HudPanelProvider {
  return {
    writeHud: (grid) => {
      if (!controller.isPaused()) return;
      grid.appendLine("center", "runtime.status", localization.paused, " ");
    },
  };
}
