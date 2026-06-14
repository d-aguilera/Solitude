import type { HudPanelProvider } from "@solitude/hud/provider";
import type { ProfilingLocalization } from "./localization";
import type { ProfilingController } from "./logic";

export function createHudPanel(
  controller: ProfilingController,
  localization: ProfilingLocalization,
): HudPanelProvider {
  return {
    writeHud: (grid) => {
      if (!controller.isEnabled()) return;
      grid.appendLine("center", "runtime.status", localization.profiling, " ");
    },
  };
}
