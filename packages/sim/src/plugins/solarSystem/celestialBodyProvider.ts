import { createKeplerianBodiesFromConfig } from "@solitude/engine/world";
import type {
  CelestialBody,
  CelestialBodyProvider,
} from "../../celestialBodies/provider";
import {
  buildDefaultSolarSystemConfigs,
  type SolarSystemConfigOptions,
} from "./solarSystem";

export function createSolarSystemCelestialBodyProvider(
  options: SolarSystemConfigOptions,
): CelestialBodyProvider {
  const solarSystem = buildDefaultSolarSystemConfigs(options);
  const setup = createKeplerianBodiesFromConfig(solarSystem.physics);

  return {
    getCelestialBody: (id) => {
      const bodyIndex = setup.bodies.findIndex((body) => body.id === id);
      if (bodyIndex < 0) return null;
      const body = setup.bodies[bodyIndex];
      const physics = setup.physics[bodyIndex];
      const celestialBody: CelestialBody = {
        id,
        mass: physics.mass,
        physicalRadius: physics.physicalRadius,
        position: body.position,
        velocity: body.velocity,
      };
      return celestialBody;
    },
  };
}
