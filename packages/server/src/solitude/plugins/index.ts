import type { GamePlugin, RuntimeOptions } from "@solitude/engine/plugin";
import { createAutopilotPlugin } from "./autopilot/index";
import {
  createPluginCompositionContext,
  type PluginCompositionContext,
} from "./pluginComposition";
import { createSolarSystemPlugin } from "./solarSystem/index";
import { createSpacecraftOperatorPlugin } from "./spacecraftOperator/index";

export type PluginFactory = (
  runtimeOptions: RuntimeOptions,
  context: PluginCompositionContext,
) => GamePlugin;

export const defaultHeadlessPluginIds = [
  "solarSystem",
  "spacecraftOperator",
  "autopilot",
];

const availableHeadlessPlugins: Record<string, PluginFactory> = {
  autopilot: createAutopilotPlugin,
  solarSystem: createSolarSystemPlugin,
  spacecraftOperator: createSpacecraftOperatorPlugin,
};

export function loadHeadlessPlugins(
  ids: readonly string[],
  runtimeOptions: RuntimeOptions = {},
): GamePlugin[] {
  const plugins: GamePlugin[] = [];
  const context = createPluginCompositionContext();
  for (const id of ids) {
    const factory = availableHeadlessPlugins[id];
    if (!factory) continue;
    plugins.push(factory(runtimeOptions, context));
  }
  return plugins;
}
