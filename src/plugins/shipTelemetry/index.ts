import type { GamePlugin } from "../../app/pluginPorts";
import { createHudPlugin } from "./hud";

export function createShipTelemetryPlugin(): GamePlugin {
  return {
    id: "shipTelemetry",
    hud: createHudPlugin(),
  };
}
