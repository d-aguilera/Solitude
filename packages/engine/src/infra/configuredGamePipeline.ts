import type { GamePipelineParams } from "../app/gamePipeline";
import { createGamePipeline } from "../app/gamePipeline";
import { createScene } from "../setup/sceneSetup";
import { createWorld } from "../setup/setup";

export type ConfiguredGamePipelineParams = Omit<
  GamePipelineParams,
  "worldAndScene"
>;

export function createConfiguredGamePipeline(
  params: ConfiguredGamePipelineParams,
) {
  const worldSetup = createWorld(params.config);
  return createGamePipeline({
    ...params,
    worldAndScene: {
      ...worldSetup,
      scene: createScene(worldSetup.world, params.config).scene,
    },
  });
}
