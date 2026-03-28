import type { WorldPhysicsConfig } from "./physicsConfigPorts.js";
import type { WorldRenderConfig } from "./renderConfigPorts.js";

export * from "./physicsConfigPorts.js";
export * from "./renderConfigPorts.js";

export interface WorldAndSceneConfig {
  enemyShipId: string;
  mainShipId: string;
  thrustLevel: number;
  physics: WorldPhysicsConfig;
  render: WorldRenderConfig;
}
