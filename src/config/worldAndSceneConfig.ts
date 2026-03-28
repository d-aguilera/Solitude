import type { WorldAndSceneConfig } from "../app/configPorts.js";
import { vec3 } from "../domain/vec3.js";
import { buildDefaultShipConfigs } from "./ships.js";
import { buildDefaultSolarSystemConfigs } from "./solarSystem.js";

export function buildWorldAndSceneConfig() {
  const solar = buildDefaultSolarSystemConfigs();
  const ships = buildDefaultShipConfigs();

  const config: WorldAndSceneConfig = {
    enemyShipId: "ship:enemy",
    mainShipId: "ship:main",
    thrustLevel: 1,
    physics: {
      planets: solar.physics,
      ships: ships.physics,
    },
    render: {
      pilotCameraOffset: vec3.create(0, 51000, 4850),
      pilotLookState: { azimuth: 0, elevation: 0 },
      topCameraOffset: vec3.create(0, 0, 500_000),
      planets: solar.render,
      ships: ships.render,
    },
  };

  return config;
}
