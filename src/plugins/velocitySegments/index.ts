import type { GamePlugin } from "../../app/pluginPorts";
import { createSegmentsPlugin } from "./core";

export function createVelocitySegmentsPlugin(): GamePlugin {
  return {
    id: "velocitySegments",
    segments: createSegmentsPlugin(),
  };
}
