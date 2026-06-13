import type { GamePlugin, RuntimeOptions } from "@solitude/engine/plugin";
import { createHudPanelProvider } from "@solitude/sim/hud/provider";
import {
  createSolitudeLocalization,
  readLocaleRuntimeOption,
} from "@solitude/sim/localization";
import { createLoopPlugin } from "./core";
import { createHudPanel } from "./hud";

export function createRuntimeTelemetryPlugin(
  runtimeOptions: RuntimeOptions = {},
): GamePlugin {
  const { plugin, controller } = createLoopPlugin();
  const localization = createSolitudeLocalization(
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
