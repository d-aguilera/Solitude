import {
  type ExternalPlugin,
  type ExternalRuntimeOptions,
} from "@solitude/plugin-api";
import { createScenePlugin } from "./core";

export function createPlugin(
  _runtimeOptions: ExternalRuntimeOptions,
): ExternalPlugin {
  return {
    id: "trajectories",
    scene: createScenePlugin(),
  };
}
