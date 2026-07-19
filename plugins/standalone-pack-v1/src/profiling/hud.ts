import type { ExternalHudPanelProvider } from "@solitude/plugin-api/hud";
import type { ProfilingLocalization } from "./localization";
import type { ProfilingController } from "./logic";

export function createHudPanel(
  controller: ProfilingController,
  localization: ProfilingLocalization,
): ExternalHudPanelProvider {
  return {
    writeHud: (grid) => {
      if (!controller.isEnabled()) return;
      grid.appendLine("center", "runtime.status", localization.profiling, " ");
    },
  };
}
