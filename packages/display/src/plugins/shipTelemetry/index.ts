import type { GamePlugin, RuntimeOptions } from "@solitude/engine/plugin";
import { createHudPanelProvider } from "@solitude/hud/provider";
import { readLocaleRuntimeOption } from "@solitude/sim/localization";
import { createHudPanel } from "./hud";
import { createShipTelemetryLocalization } from "./localization";

export function createShipTelemetryPlugin(
  runtimeOptions: RuntimeOptions = {},
): GamePlugin {
  const localization = createShipTelemetryLocalization(
    readLocaleRuntimeOption(runtimeOptions),
  );
  return {
    id: "shipTelemetry",
    capabilities: [createHudPanelProvider(createHudPanel(localization))],
    requirements: {
      mainFocus: ["controlledBody", "motionState"],
    },
  };
}
