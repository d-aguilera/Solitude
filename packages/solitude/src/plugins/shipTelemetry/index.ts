import type {
  GamePlugin,
  RuntimeOptions,
} from "@solitude/engine/app/pluginPorts";
import type { PluginCompositionContext } from "../pluginComposition";
import { createSpacecraftOperatorTelemetry } from "../spacecraftOperator/telemetry";
import { createHudPlugin } from "./hud";

export function createShipTelemetryPlugin(
  _runtimeOptions: RuntimeOptions = {},
  context?: PluginCompositionContext,
): GamePlugin {
  const telemetry =
    context?.spacecraftOperatorTelemetry ?? createSpacecraftOperatorTelemetry();
  return {
    id: "shipTelemetry",
    hud: createHudPlugin(telemetry),
    requirements: {
      mainFocus: ["controlledBody", "motionState"],
    },
  };
}
