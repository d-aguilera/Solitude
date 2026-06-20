import type { GamePlugin, RuntimeOptions } from "@solitude/engine/plugin";
import { createHudPanelProvider } from "@solitude/hud/provider";
import { createKeyboardInputProvider } from "@solitude/input/keyboard";
import { readLocaleRuntimeOption } from "@solitude/sim/localization";
import { createLoopPlugin } from "./core";
import { createHudPanel } from "./hud";
import { createInputPlugin } from "./input";
import { createTimeScaleLocalization } from "./localization";

export function createTimeScalePlugin(
  runtimeOptions: RuntimeOptions = {},
): GamePlugin {
  const { plugin, controller } = createLoopPlugin();
  const localization = createTimeScaleLocalization(
    readLocaleRuntimeOption(runtimeOptions),
  );
  return {
    id: "timeScale",
    capabilities: [
      createHudPanelProvider(createHudPanel(controller, localization)),
      createKeyboardInputProvider(createInputPlugin()),
    ],
    loop: plugin,
  };
}
