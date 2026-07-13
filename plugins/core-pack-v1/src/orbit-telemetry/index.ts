import {
  createHudPanelCapability,
  readLocaleRuntimeOption,
  type ExternalPlugin,
  type ExternalRuntimeOptions,
} from "@solitude/plugin-api";
import { createHudPanel } from "./hud";
import { createOrbitTelemetryLocalization } from "./localization";

export function createPlugin(
  runtimeOptions: ExternalRuntimeOptions,
): ExternalPlugin {
  const localization = createOrbitTelemetryLocalization(
    readLocaleRuntimeOption(runtimeOptions),
  );
  return {
    id: "orbitTelemetry",
    capabilities: [createHudPanelCapability(createHudPanel(localization))],
    requirements: {
      mainFocus: ["controlledBody", "motionState"],
    },
  };
}
