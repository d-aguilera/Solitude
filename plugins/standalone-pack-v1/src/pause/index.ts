import { createHudPanelCapability } from "@solitude/plugin-api/hud";
import { createKeyboardInputCapability } from "@solitude/plugin-api/input";
import { readLocaleRuntimeOption } from "@solitude/plugin-api/localization";
import type { ExternalPlugin } from "@solitude/plugin-api/module";
import type { ExternalRuntimeOptions } from "@solitude/plugin-api/runtime";
import { isAdventure } from "@solitude/plugin-api/standalone-session";
import { createLoopPlugin } from "./core";
import { createHudPanel } from "./hud";
import { createInputPlugin } from "./input";
import { createPauseLocalization } from "./localization";

export function createPlugin(
  runtimeOptions: ExternalRuntimeOptions,
): ExternalPlugin {
  if (isAdventure(runtimeOptions)) return { id: "pause" };
  const { loop, controller } = createLoopPlugin();
  const localization = createPauseLocalization(
    readLocaleRuntimeOption(runtimeOptions),
  );
  return {
    id: "pause",
    capabilities: [
      createHudPanelCapability(createHudPanel(controller, localization)),
      createKeyboardInputCapability(createInputPlugin()),
    ],
    hooks: { loop },
  };
}
