import type { WorldAndSceneConfig } from "../app/appPorts.js";
import { buildDefaultShipConfigs } from "./ships.js";
import { buildDefaultSolarSystemConfigs } from "./solarSystem.js";

export function buildWorldAndSceneConfig() {
  const config: WorldAndSceneConfig = {
    enemyShipId: "ship:enemy",
    mainShipId: "ship:main",
    planets: buildDefaultSolarSystemConfigs(),
    ships: buildDefaultShipConfigs(),
  };

  return config;
}
