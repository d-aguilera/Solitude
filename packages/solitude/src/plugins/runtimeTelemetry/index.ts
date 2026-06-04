import type { GamePlugin } from "@solitude/engine/plugin";
import { createHudPanelProvider } from "@solitude/sim/hud/provider";
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
