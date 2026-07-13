import {
  createHudPanelCapability,
  readLocaleRuntimeOption,
  type ExternalPlugin,
  type ExternalRuntimeOptions,
} from "@solitude/plugin-api";
import { createHudPanel } from "./hud";
import { createAutopilotLocalization } from "./localization";

export function createPlugin(
  runtimeOptions: ExternalRuntimeOptions,
): ExternalPlugin {
  const localization = createAutopilotLocalization(
    readLocaleRuntimeOption(runtimeOptions),
  );
  return {
    id: "autopilotHud",
    capabilities: [createHudPanelCapability(createHudPanel(localization))],
  };
}
