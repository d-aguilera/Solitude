import type { GamePlugin, RuntimeOptions } from "@solitude/engine/plugin";
import { createHudPanelProvider } from "@solitude/sim/hud/provider";
import {
  createSolitudeLocalization,
  readLocaleRuntimeOption,
} from "@solitude/sim/localization";
import { createHudPanel } from "./hud";

export function createShipTelemetryPlugin(
  runtimeOptions: RuntimeOptions = {},
): GamePlugin {
  const localization = createSolitudeLocalization(
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
