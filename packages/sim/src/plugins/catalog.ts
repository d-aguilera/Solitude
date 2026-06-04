import {
  loadPlugins,
  type PluginCatalog,
  type RuntimeOptions,
} from "@solitude/engine/plugin";
import { createAutopilotPlugin } from "./autopilot/index";
import {
  createPluginCompositionContext,
  type PluginCompositionContext,
} from "./pluginComposition";
import { createSolarSystemPlugin } from "./solarSystem/index";
import { createSpacecraftOperatorPlugin } from "./spacecraftOperator/index";

export const defaultHeadlessPluginIds = [
  "solarSystem",
  "spacecraftOperator",
  "autopilot",
];

export const headlessPluginCatalog: PluginCatalog<PluginCompositionContext> = {
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
    context: createPluginCompositionContext(),
    ids,
    runtimeOptions,
  });
}
