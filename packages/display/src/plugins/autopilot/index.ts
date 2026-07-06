import type { GamePlugin, RuntimeOptions } from "@solitude/engine/plugin";
import { createHudPanelProvider } from "@solitude/hud/provider";
import { readLocaleRuntimeOption } from "@solitude/localization";
import { createHudPanel } from "./hud";
import { createAutopilotLocalization } from "./localization";

export function createAutopilotHudPlugin(
  runtimeOptions: RuntimeOptions = {},
): GamePlugin {
  const localization = createAutopilotLocalization(
    readLocaleRuntimeOption(runtimeOptions),
  );
  return {
    id: "autopilotHud",
    capabilities: [createHudPanelProvider(createHudPanel(localization))],
  };
}
