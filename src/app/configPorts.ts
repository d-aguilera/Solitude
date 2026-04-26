import type { EntityConfig, EntityId } from "./entityConfigPorts";
import type { WorldPhysicsConfig } from "./physicsConfigPorts";
import type { WorldRenderConfig } from "./renderConfigPorts";

export * from "./entityConfigPorts";
export * from "./physicsConfigPorts";
export * from "./renderConfigPorts";

export interface WorldAndSceneConfig {
  entities: EntityConfig[];
  mainControlledEntityId: EntityId;
  mainShipId: string;
  thrustLevel: number;
  physics: WorldPhysicsConfig;
  render: WorldRenderConfig;
}
