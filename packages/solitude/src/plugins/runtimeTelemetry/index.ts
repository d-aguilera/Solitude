import type { GamePlugin, RuntimeOptions } from "@solitude/engine/plugin";
import { createHudPanelProvider } from "@solitude/hud/provider";
import { readLocaleRuntimeOption } from "@solitude/localization";
import { createLoopPlugin } from "./core";
import { createHudPanel } from "./hud";
import { createRuntimeTelemetryLocalization } from "./localization";

export function createRuntimeTelemetryPlugin(
  runtimeOptions: RuntimeOptions = {},
): GamePlugin {
  const { plugin, controller } = createLoopPlugin();
  const localization = createRuntimeTelemetryLocalization(
    readLocaleRuntimeOption(runtimeOptions),
  );
  return {
    id: "runtimeTelemetry",
    capabilities: [
      createHudPanelProvider(createHudPanel(controller, localization)),
    ],
    loop: plugin,
  };
}
