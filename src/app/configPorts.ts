import type { WorldPhysicsConfig } from "./physicsConfigPorts";
import type { WorldRenderConfig } from "./renderConfigPorts";

export * from "./physicsConfigPorts";
export * from "./renderConfigPorts";

export interface WorldAndSceneConfig {
  enemyShipId: string;
  mainShipId: string;
  thrustLevel: number;
  physics: WorldPhysicsConfig;
  render: WorldRenderConfig;
}
