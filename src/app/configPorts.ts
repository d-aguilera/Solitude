import type { EntityConfig, EntityId } from "./entityConfigPorts";
import type { WorldRenderConfig } from "./renderConfigPorts";

export * from "./entityConfigPorts";
export * from "./physicsConfigPorts";
export * from "./renderConfigPorts";

export interface WorldAndSceneConfig {
  entities: EntityConfig[];
  mainFocusEntityId: EntityId;
  thrustLevel: number;
  render: WorldRenderConfig;
}

export type WorldFocusConfig = Pick<WorldAndSceneConfig, "mainFocusEntityId">;

export function requireMainFocusEntityId(config: WorldFocusConfig): EntityId {
  if (!config.mainFocusEntityId) {
    throw new Error("World config is missing mainFocusEntityId");
  }
  return config.mainFocusEntityId;
}
