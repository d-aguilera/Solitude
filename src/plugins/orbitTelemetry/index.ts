import type { GamePlugin } from "../../app/pluginPorts";
import { createHudPlugin } from "./hud";

export function createOrbitTelemetryPlugin(): GamePlugin {
  return {
    id: "orbitTelemetry",
    hud: createHudPlugin(),
  };
}
