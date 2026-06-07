import type { GamePlugin } from "@solitude/engine/plugin";
import { createHudPanelProvider } from "@solitude/sim/hud/provider";
import { createHudPanel } from "./hud";

export function createOrbitTelemetryPlugin(): GamePlugin {
  return {
    id: "orbitTelemetry",
    capabilities: [createHudPanelProvider(createHudPanel())],
    requirements: {
      mainFocus: ["controlledBody", "motionState"],
    },
  };
}
