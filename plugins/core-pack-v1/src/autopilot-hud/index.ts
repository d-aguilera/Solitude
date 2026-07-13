import { createHudPanelCapability } from "@solitude/plugin-api/capabilities";
import { readLocaleRuntimeOption } from "@solitude/plugin-api/localization";
import type {
  ExternalPlugin,
  ExternalRuntimeOptions,
} from "@solitude/plugin-api/plugin";
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
