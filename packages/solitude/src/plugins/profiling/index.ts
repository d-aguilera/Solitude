import type { GamePlugin, RuntimeOptions } from "@solitude/engine/plugin";
import { createHudPanelProvider } from "@solitude/sim/hud/provider";
import { readLocaleRuntimeOption } from "@solitude/sim/localization";
import { createLoopPlugin } from "./core";
import { createHudPanel } from "./hud";
import { createInputPlugin } from "./input";
import { createProfilingLocalization } from "./localization";

export function createProfilingPlugin(
  runtimeOptions: RuntimeOptions = {},
): GamePlugin {
  const { plugin, controller } = createLoopPlugin();
  const localization = createProfilingLocalization(
    readLocaleRuntimeOption(runtimeOptions),
  );
  return {
    id: "profiling",
    capabilities: [
      createHudPanelProvider(createHudPanel(controller, localization)),
    ],
    input: createInputPlugin(),
    loop: plugin,
  };
}
