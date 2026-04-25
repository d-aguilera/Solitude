import type { GamePlugin } from "../../app/pluginPorts";
import { createLoopPlugin } from "./core";
import { createHudPlugin } from "./hud";

export function createRuntimeTelemetryPlugin(): GamePlugin {
  const { plugin, controller } = createLoopPlugin();
  return {
    id: "runtimeTelemetry",
    hud: createHudPlugin(controller),
    loop: plugin,
  };
}
