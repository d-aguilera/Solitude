import {
  createHeadlessLoop,
  type HeadlessLoop,
} from "@solitude/engine/runtime";
import {
  applyWorldModelPlugins,
  type EntityConfig,
  type WorldAndSceneConfig,
} from "@solitude/engine/world";
import { buildWorldAndSceneConfig } from "./config/worldAndSceneConfig";
import { defaultPluginIds, loadPlugins } from "./plugins/index";

export interface SolitudeHeadlessLoopOptions {
  extraEntities?: readonly EntityConfig[];
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
  if (options.extraEntities) {
    config.entities.push(...options.extraEntities);
    config.mainFocusEntityId ||= options.extraEntities[0]?.id ?? "";
  }

  return {
    config,
    loop: createHeadlessLoop(config, { plugins }),
  };
}

export {
  buildSolarSystemBodyEntities,
  buildSolarSystemShipEntity,
} from "./plugins/solarSystem/index";
export { buildDefaultSolarSystemConfigs } from "./plugins/solarSystem/solarSystem";
export { defaultPluginIds, loadPlugins };
