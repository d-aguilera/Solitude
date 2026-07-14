import {
  controllableEntityProviderCapability,
  isControllableEntityProvider,
} from "@solitude/engine/controllable-entities";
import { km } from "@solitude/engine/math";
import type { GamePlugin } from "@solitude/engine/plugin";
import {
  celestialBodyProviderCapability,
  isCelestialBodyProvider,
} from "@solitude/sim/celestialBodies/provider";
import { createOrbitingPlacement } from "@solitude/sim/spacecraft/orbitalPlacement";

const EARTH_ID = "planet:earth";
const POLY_FIGHTER_PROVIDER_ID = "polyFighter";
const SHIP_START_ALTITUDE_M = 100 * km;
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
        const polyFighter = capabilityRegistry
          .getAll(controllableEntityProviderCapability)
          .filter(isControllableEntityProvider)
          .find((provider) => provider.id === POLY_FIGHTER_PROVIDER_ID);
        if (!polyFighter) {
          throw new Error(
            `Ships plugin requires controllable entity provider: ${POLY_FIGHTER_PROVIDER_ID}`,
          );
        }

        registry.addEntities(
          STANDALONE_SHIPS.map((ship, index) =>
            polyFighter.createEntity({
              color: ship.color,
              id: ship.id,
              placement: createOrbitingPlacement({
                altitudeMeters: SHIP_START_ALTITUDE_M,
                anchorBody: earth,
                entityMass: polyFighter.mass,
                ringCount: STANDALONE_SHIPS.length,
                ringIndex: index,
              }),
            }),
          ),
        );
        registry.setMainFocusEntityId(STANDALONE_SHIPS[0].id);
      },
    },
  };
}
