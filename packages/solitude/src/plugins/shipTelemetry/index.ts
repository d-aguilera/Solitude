import type { GamePlugin, RuntimeOptions } from "@solitude/engine/plugin";
import { createHudPanelProvider } from "@solitude/sim/hud/provider";
import { createSpacecraftOperatorTelemetry } from "@solitude/sim/plugins/spacecraftOperator/telemetry";
import type { PluginCompositionContext } from "../pluginComposition";
import { createHudPanel } from "./hud";

export function createShipTelemetryPlugin(
  _runtimeOptions: RuntimeOptions = {},
  context?: PluginCompositionContext,
): GamePlugin {
  const telemetry =
    context?.spacecraftOperatorTelemetry ?? createSpacecraftOperatorTelemetry();
  return {
    id: "shipTelemetry",
    capabilities: [createHudPanelProvider(createHudPanel(telemetry))],
    requirements: {
      mainFocus: ["controlledBody", "motionState"],
    },
  };
}
