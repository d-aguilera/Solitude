import type { WorldAndSceneConfig } from "../app/configPorts";
import { vec3 } from "../domain/vec3";
import { buildDefaultShipConfigs } from "./ships";
import { buildDefaultSolarSystemConfigs } from "./solarSystem";

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
      leftCameraOffset: vec3.create(500_000, 51_000, 4_850),
      rightCameraOffset: vec3.create(-500_000, 51_000, 4_850),
      rearCameraOffset: vec3.create(0, 500_000, 4_850),
      planets: solar.render,
      ships: ships.render,
    },
  };

  return config;
}
