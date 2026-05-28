import {
  createHeadlessLoop,
  type HeadlessLoop,
} from "@solitude/engine/runtime";
import {
  applyWorldModelPlugins,
  type EntityConfig,
  type WorldAndSceneConfig,
} from "@solitude/engine/world";
import { defaultHeadlessPluginIds, loadHeadlessPlugins } from "./plugins/index";
import { buildWorldAndSceneConfig } from "./worldAndSceneConfig";

export interface SolitudeHeadlessLoopOptions {
  extraEntities?: readonly EntityConfig[];
  pluginIds?: readonly string[];
  runtimeOptions?: Parameters<typeof loadHeadlessPlugins>[1];
}

export interface SolitudeHeadlessLoop {
  config: WorldAndSceneConfig;
  loop: HeadlessLoop;
}

export function createSolitudeHeadlessLoop(
  options: SolitudeHeadlessLoopOptions = {},
): SolitudeHeadlessLoop {
  const config = buildWorldAndSceneConfig();
  const plugins = loadHeadlessPlugins(
    [...(options.pluginIds ?? defaultHeadlessPluginIds)],
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
export { defaultHeadlessPluginIds, loadHeadlessPlugins };
