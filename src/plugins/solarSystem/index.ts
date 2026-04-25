import type { GamePlugin } from "../../app/pluginPorts";
import { buildDefaultSolarSystemShipConfigs } from "./ships";
import { buildDefaultSolarSystemConfigs } from "./solarSystem";

export function createSolarSystemPlugin(): GamePlugin {
  return {
    id: "solarSystem",
    worldModel: {
      contributeWorldModel: (registry) => {
        const solarSystem = buildDefaultSolarSystemConfigs();
        registry.addCelestialBodies(solarSystem);
        registry.addShips(
          buildDefaultSolarSystemShipConfigs(solarSystem.physics),
        );
        registry.setMainShipId("ship:main");
      },
    },
  };
}
