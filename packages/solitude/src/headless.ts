import {
  createHeadlessLoop,
  type HeadlessLoop,
} from "@solitude/engine/runtime";
import {
  applyWorldModelPlugins,
  type WorldAndSceneConfig,
} from "@solitude/engine/world";
import { buildWorldAndSceneConfig } from "./config/worldAndSceneConfig";
import { defaultPluginIds, loadPlugins } from "./plugins/index";

export interface SolitudeHeadlessLoopOptions {
  pluginIds?: readonly string[];
  runtimeOptions?: Parameters<typeof loadPlugins>[1];
}

export interface SolitudeHeadlessLoop {
  config: WorldAndSceneConfig;
  loop: HeadlessLoop;
}

export function createSolitudeHeadlessLoop(
  options: SolitudeHeadlessLoopOptions = {},
): SolitudeHeadlessLoop {
  const config = buildWorldAndSceneConfig();
  const plugins = loadPlugins(
    [...(options.pluginIds ?? defaultPluginIds)],
    options.runtimeOptions,
  );

  applyWorldModelPlugins(config, plugins);

  return {
    config,
    loop: createHeadlessLoop(config, { plugins }),
  };
}

export { defaultPluginIds, loadPlugins };
