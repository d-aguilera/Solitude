import type { WorldState, Vec3, BodyId } from "./types.js";

export interface GravitatingBody {
  id: BodyId;
  mass: number;
  position: Vec3;
  velocity: Vec3;
}

/**
 * Construct the list of gravitating bodies (planes + planets) from the
 * current world state. Mass for planets is derived from PlanetPhysics on
 * the world; plane mass is a gameplay constant.
 *
 * This keeps gravity-specific physical properties and discovery logic
 * in one place, decoupled from the scene graph and visual objects.
 */
export function getGravitatingBodies(
  world: WorldState,
  existingVelocitiesById: Map<BodyId, Vec3> | null
): GravitatingBody[] {
  const bodies: GravitatingBody[] = [];

  // 1) Planes: give them a plausible mass and take their position from world.
  const planeMass = 5e4; // gameplay-tuned mass for planes

  for (const plane of world.planes) {
    const velocity = existingVelocitiesById?.get(plane.id) ?? {
      x: 0,
      y: 0,
      z: 0,
    };

    bodies.push({
      id: plane.id,
      mass: planeMass,
      position: plane.position,
      velocity: { ...velocity },
    });
  }

  // 2) Planets: derive mass and physical parameters from world.planetPhysics
  for (const planetBody of world.planets) {
    const physics = world.planetPhysics.find((p) => p.id === planetBody.id);
    if (!physics) {
      // If no physics entry exists, skip this planet; keeps gravity robust
      // against partially-initialized worlds.
      continue;
    }

    // Use any existing velocity if present; otherwise, seed from world.planets.
    const existingV = existingVelocitiesById?.get(planetBody.id);
    const velocity: Vec3 = existingV
      ? { ...existingV }
      : { ...planetBody.velocity };

    bodies.push({
      id: planetBody.id,
      mass: physics.mass,
      position: planetBody.position,
      velocity,
    });
  }

  return bodies;
}
