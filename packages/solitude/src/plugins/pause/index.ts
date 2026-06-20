import type { GamePlugin, RuntimeOptions } from "@solitude/engine/plugin";
import { createHudPanelProvider } from "@solitude/hud/provider";
import { createKeyboardInputProvider } from "@solitude/input/keyboard";
import { readLocaleRuntimeOption } from "@solitude/localization";
import { createLoopPlugin } from "./core";
import { createHudPanel } from "./hud";
import { createInputPlugin } from "./input";
import { createPauseLocalization } from "./localization";

export function createPausePlugin(
  runtimeOptions: RuntimeOptions = {},
): GamePlugin {
  const { loop, controller } = createLoopPlugin();
  const localization = createPauseLocalization(
    readLocaleRuntimeOption(runtimeOptions),
  );
  return {
    id: "pause",
    capabilities: [
      createHudPanelProvider(createHudPanel(controller, localization)),
      createKeyboardInputProvider(createInputPlugin()),
    ],
    loop,
  };
}
