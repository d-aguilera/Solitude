import {
  createHudPanelCapability,
  readLocaleRuntimeOption,
  type ExternalPlugin,
  type ExternalRuntimeOptions,
} from "@solitude/plugin-api";
import { createHudPanel } from "./hud";
import { createShipTelemetryLocalization } from "./localization";

export function createPlugin(
  runtimeOptions: ExternalRuntimeOptions,
): ExternalPlugin {
  const localization = createShipTelemetryLocalization(
    readLocaleRuntimeOption(runtimeOptions),
  );
  return {
    id: "shipTelemetry",
    capabilities: [createHudPanelCapability(createHudPanel(localization))],
    requirements: {
      mainFocus: ["controlledBody", "motionState"],
    },
  };
}
