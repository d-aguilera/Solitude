import type { GamePlugin } from "@solitude/engine/app/pluginPorts";
import { createHudPlugin } from "./hud";

export function createOrbitTelemetryPlugin(): GamePlugin {
  return {
    id: "orbitTelemetry",
    hud: createHudPlugin(),
    requirements: {
      mainFocus: ["controlledBody", "motionState"],
    },
  };
}
