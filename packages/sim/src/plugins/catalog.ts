import {
  loadPlugins,
  type PluginCatalog,
  type RuntimeOptions,
} from "@solitude/engine/plugin";
import { createAutopilotPlugin } from "./autopilot/index";
import { createSpacecraftOperatorPlugin } from "./spacecraftOperator/index";

export const defaultHeadlessPluginIds = ["spacecraftOperator", "autopilot"];

export const simPluginCatalog: PluginCatalog = {
  autopilot: createAutopilotPlugin,
  spacecraftOperator: createSpacecraftOperatorPlugin,
};

export const headlessPluginCatalog: PluginCatalog = {
  autopilot: simPluginCatalog.autopilot,
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
