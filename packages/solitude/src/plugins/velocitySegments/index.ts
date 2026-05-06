import type { GamePlugin } from "@solitude/engine/app/pluginPorts";
import { createSegmentsPlugin } from "./core";

export function createVelocitySegmentsPlugin(): GamePlugin {
  return {
    id: "velocitySegments",
    requirements: {
      mainFocus: ["controlledBody", "motionState"],
    },
    segments: createSegmentsPlugin(),
  };
}
