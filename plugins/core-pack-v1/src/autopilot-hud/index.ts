import { createHudPanelCapability } from "@solitude/plugin-api/hud";
import { readLocaleRuntimeOption } from "@solitude/plugin-api/localization";
import type { ExternalPlugin } from "@solitude/plugin-api/module";
import type { ExternalRuntimeOptions } from "@solitude/plugin-api/runtime";
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
