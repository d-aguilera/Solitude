import type { GamePlugin, RuntimeOptions } from "@solitude/engine/plugin";
import { createHudPanelProvider } from "@solitude/sim/hud/provider";
import { readLocaleRuntimeOption } from "@solitude/sim/localization";
import { createHudPanel } from "./hud";
import { createOrbitTelemetryLocalization } from "./localization";

export function createOrbitTelemetryPlugin(
  runtimeOptions: RuntimeOptions = {},
): GamePlugin {
  const localization = createOrbitTelemetryLocalization(
    readLocaleRuntimeOption(runtimeOptions),
  );
  return {
    id: "orbitTelemetry",
    capabilities: [createHudPanelProvider(createHudPanel(localization))],
    requirements: {
      mainFocus: ["controlledBody", "motionState"],
    },
  };
}
