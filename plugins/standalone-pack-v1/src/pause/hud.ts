import type { ExternalHudPanelProvider } from "@solitude/plugin-api/hud";
import type { PauseLocalization } from "./localization";
import type { PauseController } from "./logic";

export function createHudPanel(
  controller: PauseController,
  localization: PauseLocalization,
): ExternalHudPanelProvider {
  return {
    writeHud: (grid) => {
      if (!controller.isPaused()) return;
      grid.appendLine("center", "runtime.status", localization.paused, " ");
    },
  };
}
