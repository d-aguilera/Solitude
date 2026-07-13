import type {
  ExternalPlugin,
  ExternalRuntimeOptions,
} from "@solitude/plugin-api/plugin";
import { createScenePlugin } from "./core";

export function createPlugin(
  _runtimeOptions: ExternalRuntimeOptions,
): ExternalPlugin {
  return {
    id: "trajectories",
    scene: createScenePlugin(),
  };
}
