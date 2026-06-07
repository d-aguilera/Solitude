import {
  loadPlugins,
  type PluginCatalog,
  type RuntimeOptions,
} from "@solitude/engine/plugin";
import { createAutopilotPlugin } from "./autopilot/index";
import { createSolarSystemPlugin } from "./solarSystem/index";
import { createSpacecraftOperatorPlugin } from "./spacecraftOperator/index";

export const defaultHeadlessPluginIds = [
  "solarSystem",
  "spacecraftOperator",
  "autopilot",
];

export const headlessPluginCatalog: PluginCatalog = {
  autopilot: createAutopilotPlugin,
  solarSystem: createSolarSystemPlugin,
  spacecraftOperator: createSpacecraftOperatorPlugin,
};

export function loadHeadlessPlugins(
  ids: readonly string[],
  runtimeOptions: RuntimeOptions = {},
) {
  return loadPlugins({
    catalog: headlessPluginCatalog,
    ids,
    runtimeOptions,
  });
}
