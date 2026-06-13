import type { HudPanelProvider } from "@solitude/sim/hud/provider";
import { type SolitudeLocalization } from "@solitude/sim/localization";
import type { ProfilingController } from "./logic";

export function createHudPanel(
  controller: ProfilingController,
  localization: SolitudeLocalization,
): HudPanelProvider {
  const { hud } = localization;
  return {
    writeHud: (grid) => {
      if (!controller.isEnabled()) return;
      grid.appendLine("center", "runtime.status", hud.profiling);
    },
  };
}
