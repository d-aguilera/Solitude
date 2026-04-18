import type { GamePlugin } from "../../app/pluginPorts";
import { createHudPlugin } from "./hud";

export function createRuntimeTelemetryPlugin(): GamePlugin {
  return {
    id: "runtimeTelemetry",
    hud: createHudPlugin(),
  };
}
