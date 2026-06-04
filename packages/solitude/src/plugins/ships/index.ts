import { km } from "@solitude/engine/math";
import type { GamePlugin } from "@solitude/engine/plugin";
import {
  celestialBodyProviderCapability,
  isCelestialBodyProvider,
} from "@solitude/sim/celestialBodies/provider";
import { createOrbitingSpacecraftEntity } from "@solitude/sim/spacecraft/entityFactory";

const EARTH_ID = "planet:earth";
const SHIP_DENSITY_KG_PER_M3 = 2700;
const SHIP_START_ALTITUDE_M = 100 * km;
const SHIP_MESH_SCALE = 150_000;
const STANDALONE_SHIPS = [
  {
    color: { r: 0, g: 255, b: 255 },
    id: "ship:blue",
  },
  {
    color: { r: 255, g: 64, b: 64 },
    id: "ship:red",
  },
] as const;

export function createShipsPlugin(): GamePlugin {
  return {
    id: "ships",
    worldModel: {
      contributeWorldModel: (registry, { capabilityRegistry }) => {
        const provider = capabilityRegistry
          .getAll(celestialBodyProviderCapability)
          .find(isCelestialBodyProvider);
        if (!provider) {
          throw new Error("Ships plugin requires celestialBodyProvider");
        }
        const earth = provider.getCelestialBody(EARTH_ID);
        if (!earth) {
          throw new Error(`Ships plugin requires celestial body: ${EARTH_ID}`);
        }

        registry.addEntities(
          STANDALONE_SHIPS.map((ship, index) =>
            createOrbitingSpacecraftEntity({
              altitudeMeters: SHIP_START_ALTITUDE_M,
              anchorBody: earth,
              color: ship.color,
              densityKgPerM3: SHIP_DENSITY_KG_PER_M3,
              id: ship.id,
              meshScale: SHIP_MESH_SCALE,
              ringCount: STANDALONE_SHIPS.length,
              ringIndex: index,
            }),
          ),
        );
        registry.setMainFocusEntityId(STANDALONE_SHIPS[0].id);
      },
    },
  };
}
