import type {
  GamePlugin,
  RuntimeOptions,
} from "@solitude/engine/app/pluginPorts";
import { createHudPanelProvider } from "../hud/capabilities";
import type { PluginCompositionContext } from "../pluginComposition";
import { createSpacecraftOperatorTelemetry } from "../spacecraftOperator/telemetry";
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
