import {
  loadPlugins,
  type PluginCatalog,
  type RuntimeOptions,
} from "@solitude/engine/plugin";
import { createAutopilotPlugin } from "./autopilot/index";
import { createAutopilotInputPlugin } from "./autopilot/input";
import { createSolarSystemPlugin } from "./solarSystem/index";
import { createSpacecraftOperatorPlugin } from "./spacecraftOperator/index";

export const defaultHeadlessPluginIds = [
  "solarSystem",
  "spacecraftOperator",
  "autopilot",
];

export const simPluginCatalog: PluginCatalog = {
  autopilot: createAutopilotPlugin,
  autopilotInput: createAutopilotInputPlugin,
  solarSystem: createSolarSystemPlugin,
  spacecraftOperator: createSpacecraftOperatorPlugin,
};

export const headlessPluginCatalog: PluginCatalog = {
  autopilot: simPluginCatalog.autopilot,
  solarSystem: simPluginCatalog.solarSystem,
  spacecraftOperator: simPluginCatalog.spacecraftOperator,
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
