import type { GamePlugin } from "@solitude/engine/plugin";
import { createHudPanelProvider } from "../hud/capabilities";
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
