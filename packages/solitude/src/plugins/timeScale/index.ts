import type { GamePlugin, RuntimeOptions } from "@solitude/engine/plugin";
import { createHudPanelProvider } from "@solitude/sim/hud/provider";
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
    ],
    input: createInputPlugin(),
    loop: plugin,
  };
}
