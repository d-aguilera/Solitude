import type { GamePlugin, RuntimeOptions } from "@solitude/engine/plugin";
import { createHudPanelProvider } from "@solitude/sim/hud/provider";
import { createHudPanel } from "./hud";

export function createShipTelemetryPlugin(
  _runtimeOptions: RuntimeOptions = {},
): GamePlugin {
  return {
    id: "shipTelemetry",
    capabilities: [createHudPanelProvider(createHudPanel())],
    requirements: {
      mainFocus: ["controlledBody", "motionState"],
    },
  };
}
