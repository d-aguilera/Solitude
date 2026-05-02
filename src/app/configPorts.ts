import type { EntityConfig, EntityId } from "./entityConfigPorts";
import type { WorldRenderConfig } from "./renderConfigPorts";

export * from "./entityConfigPorts";
export * from "./physicsConfigPorts";
export * from "./renderConfigPorts";

export interface WorldAndSceneConfig {
  entities: EntityConfig[];
  mainFocusEntityId?: EntityId;
  /** @deprecated Use mainFocusEntityId. */
  mainControlledEntityId?: EntityId;
  thrustLevel: number;
  render: WorldRenderConfig;
}

export type WorldFocusConfig = Pick<
  WorldAndSceneConfig,
  "mainControlledEntityId" | "mainFocusEntityId"
>;

export function getMainFocusEntityId(
  config: WorldFocusConfig,
): EntityId | undefined {
  return config.mainFocusEntityId || config.mainControlledEntityId;
}

export function requireMainFocusEntityId(config: WorldFocusConfig): EntityId {
  const entityId = getMainFocusEntityId(config);
  if (!entityId) {
    throw new Error("World config is missing mainFocusEntityId");
  }
  return entityId;
}
