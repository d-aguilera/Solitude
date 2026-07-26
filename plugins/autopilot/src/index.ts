import type { ExternalPlugin } from "@solitude/plugin-api/module";
import type { ExternalRuntimeOptions } from "@solitude/plugin-api/runtime";
import {
  createAutonomousControlProvider,
  createControlPlugin,
  createPropulsionResolverProvider,
} from "./core";

export function createPlugin(
  runtimeOptions: ExternalRuntimeOptions = {},
): ExternalPlugin {
  void runtimeOptions;
  return {
    id: "autopilot",
    capabilities: [
      createAutonomousControlProvider(),
      createPropulsionResolverProvider(),
    ],
    hooks: { controls: createControlPlugin() },
  };
}
