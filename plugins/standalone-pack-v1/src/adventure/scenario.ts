import {
  celestialBodyProviderCapability,
  isCelestialBodyProvider,
} from "@solitude/plugin-api/celestial-bodies";
import {
  controllableEntityProviderCapability,
  isControllableEntityProvider,
} from "@solitude/plugin-api/controllable-entities";
import { mat3, vec3 } from "@solitude/plugin-api/math";
import type { ExternalWorldModelPlugin } from "@solitude/plugin-api/world-model";

export const adventureEntityId = "ship:first-orbit";
export const adventureEarthId = "planet:earth";
const NEWTON_G = 6.6743e-11;

export function createScenario(): ExternalWorldModelPlugin {
  return {
    contributeWorldModel: (registry, { capabilityRegistry }) => {
      const earth = capabilityRegistry
        .getAll(celestialBodyProviderCapability)
        .filter(isCelestialBodyProvider)
        .map((provider) => provider.getCelestialBody(adventureEarthId))
        .find((body) => body !== null);
      const providers = capabilityRegistry
        .getAll(controllableEntityProviderCapability)
        .filter(isControllableEntityProvider)
        .filter((provider) => provider.id === "polyFighter");
      if (!earth || providers.length !== 1)
        throw new Error(
          "My First Orbit requires Earth and one polyFighter provider",
        );
      const ra = earth.physicalRadius + 400_000;
      const rp = earth.physicalRadius - 50_000;
      const speed = Math.sqrt(NEWTON_G * earth.mass * (2 / ra - 2 / (ra + rp)));
      if (!Number.isFinite(speed) || speed <= 0 || rp <= 0)
        throw new Error("Invalid My First Orbit Earth data");
      // Face Earth-relative +Y prograde, with Earth (-X) initially on the left.
      const frame = {
        right: vec3.create(1, 0, 0),
        forward: vec3.create(0, 1, 0),
        up: vec3.create(0, 0, 1),
      };
      const orientation = mat3.zero();
      mat3.copy(mat3.identity, orientation);
      registry.addEntities([
        providers[0].createEntity({
          color: { r: 0, g: 255, b: 255 },
          id: adventureEntityId,
          placement: {
            angularVelocity: { pitch: 0, roll: 0, yaw: 0 },
            frame,
            orientation,
            position: vec3.addInto(
              vec3.zero(),
              earth.position,
              vec3.create(ra, 0, 0),
            ),
            velocity: vec3.addInto(
              vec3.zero(),
              earth.velocity,
              vec3.create(0, speed, 0),
            ),
          },
        }),
      ]);
      registry.setMainFocusEntityId(adventureEntityId);
    },
  };
}
