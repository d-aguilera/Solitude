import {
  celestialBodyProviderCapability,
  isCelestialBodyProvider,
} from "@solitude/plugin-api/celestial-bodies";
import {
  controllableEntityProviderCapability,
  isControllableEntityProvider,
} from "@solitude/plugin-api/controllable-entities";
import type { ExternalPlugin } from "@solitude/plugin-api/module";
import { createOrbitingPlacement } from "@solitude/plugin-api/orbits";
import type { ExternalRuntimeOptions } from "@solitude/plugin-api/runtime";
import type { ExternalWorldModelPlugin } from "@solitude/plugin-api/world-model";

const EARTH_ID = "planet:earth";
const POLY_FIGHTER_PROVIDER_ID = "polyFighter";
const SHIP_START_ALTITUDE_M = 100_000;
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

export function createPlugin(
  _runtimeOptions: ExternalRuntimeOptions,
): ExternalPlugin {
  return {
    id: "ships",
    hooks: { worldModel: createWorldModelPlugin() },
  };
}

function createWorldModelPlugin(): ExternalWorldModelPlugin {
  return {
    contributeWorldModel: (registry, { capabilityRegistry }) => {
      const celestialBodies = capabilityRegistry
        .getAll(celestialBodyProviderCapability)
        .find(isCelestialBodyProvider);
      if (!celestialBodies) {
        throw new Error("Ships plugin requires celestialBodyProvider");
      }
      const earth = celestialBodies.getCelestialBody(EARTH_ID);
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
  };
}
