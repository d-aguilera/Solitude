import type { GamePlugin } from "@solitude/engine/app/pluginPorts";
import { createHudPanelProvider } from "../hud/capabilities";
import { createLoopPlugin } from "./core";
import { createHudPanel } from "./hud";

export function createRuntimeTelemetryPlugin(): GamePlugin {
  const { plugin, controller } = createLoopPlugin();
  return {
    id: "runtimeTelemetry",
    capabilities: [createHudPanelProvider(createHudPanel(controller))],
    loop: plugin,
  };
}
