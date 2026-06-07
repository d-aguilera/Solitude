import type { GamePlugin, RuntimeOptions } from "@solitude/engine/plugin";
import { createHudPanelProvider } from "@solitude/sim/hud/provider";
import type { PluginCompositionContext } from "../pluginComposition";
import { createHudPanel } from "./hud";

export function createShipTelemetryPlugin(
  _runtimeOptions: RuntimeOptions,
  context: PluginCompositionContext,
): GamePlugin {
  return {
    id: "shipTelemetry",
    capabilities: [
      createHudPanelProvider(
        createHudPanel(context.spacecraftOperatorTelemetry),
      ),
    ],
    requirements: {
      mainFocus: ["controlledBody", "motionState"],
    },
  };
}
