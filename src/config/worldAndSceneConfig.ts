import type { WorldAndSceneConfig } from "../app/configPorts.js";
import { vec3 } from "../domain/vec3.js";
import { buildDefaultShipConfigs } from "./ships.js";
import { buildDefaultSolarSystemConfigs } from "./solarSystem.js";

export function buildWorldAndSceneConfig() {
  const config: WorldAndSceneConfig = {
    enemyShipId: "ship:enemy",
    mainShipId: "ship:main",
    pilotCameraOffset: vec3.create(0, 51000, 4850),
    pilotLookState: { azimuth: 0, elevation: 0 },
    planets: buildDefaultSolarSystemConfigs(),
    ships: buildDefaultShipConfigs(),
    thrustLevel: 1,
    topCameraOffset: vec3.create(0, 0, 500_000),
  };

  return config;
}
