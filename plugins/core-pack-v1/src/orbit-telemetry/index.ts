import { createHudPanelCapability } from "@solitude/plugin-api/capabilities";
import { readLocaleRuntimeOption } from "@solitude/plugin-api/localization";
import type {
  ExternalPlugin,
  ExternalRuntimeOptions,
} from "@solitude/plugin-api/plugin";
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
