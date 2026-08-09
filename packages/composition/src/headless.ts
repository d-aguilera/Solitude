import type { GamePlugin } from "@solitude/engine/plugin";
import {
  createHeadlessLoop,
  createNewtonianGravityPlugin,
  type HeadlessLoop,
} from "@solitude/engine/runtime";
import {
  applyWorldModelPlugins,
  type EntityConfig,
  type WorldAndSceneConfig,
} from "@solitude/engine/world";
import { buildWorldAndSceneConfig } from "./worldAndSceneConfig";

export interface SolitudeHeadlessLoopOptions {
  extraEntities?: readonly EntityConfig[];
  plugins: readonly GamePlugin[];
}

export interface SolitudeHeadlessLoop {
  config: WorldAndSceneConfig;
  loop: HeadlessLoop;
}

export function createSolitudeHeadlessLoop(
  options: SolitudeHeadlessLoopOptions,
): SolitudeHeadlessLoop {
  const config = buildWorldAndSceneConfig();
  const plugins = [...options.plugins, createNewtonianGravityPlugin()];

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
