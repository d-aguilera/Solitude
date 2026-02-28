import { buildDefaultShipConfigs } from "./ships.js";
import { buildDefaultSolarSystemConfigs } from "./solarSystem.js";

export function buildWorldAndSceneConfig() {
  return {
    mainShipId: "ship:main",
    planets: buildDefaultSolarSystemConfigs(),
    ships: buildDefaultShipConfigs(),
  };
}
