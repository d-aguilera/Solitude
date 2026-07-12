import type {
  ExternalPlugin,
  ExternalRuntimeOptions,
} from "@solitude/plugin-api";
import { createSegmentsPlugin } from "./core";

export function createPlugin(
  _runtimeOptions: ExternalRuntimeOptions,
): ExternalPlugin {
  return {
    id: "velocitySegments",
    requirements: {
      mainFocus: ["controlledBody", "motionState"],
    },
    segments: createSegmentsPlugin(),
  };
}
