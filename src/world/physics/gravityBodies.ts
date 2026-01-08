import type { WorldState, Vec3, BodyId } from "../../world/types.js";

export interface GravitatingBody {
  id: BodyId;
  mass: number;
  position: Vec3;
  velocity: Vec3;
}

/**
 * Construct the list of gravitating bodies (planes + planets + stars) from the
 * current world state.
 */
export function getGravitatingBodies(
  world: WorldState,
  existingVelocitiesById: Map<BodyId, Vec3> | null
): GravitatingBody[] {
  const bodies: GravitatingBody[] = [];

  // 1) Planes
  const planeMass = 5e4; // gameplay-tuned mass for planes

  for (const plane of world.planes) {
    const velocity = existingVelocitiesById?.get(plane.id) ??
      plane.velocity ?? { x: 0, y: 0, z: 0 };

    bodies.push({
      id: plane.id,
      mass: planeMass,
      position: plane.position,
      velocity,
    });
  }

  // 2) Planets
  for (const planetBody of world.planets) {
    const physics = world.planetPhysics.find((p) => p.id === planetBody.id);
    if (!physics) continue;

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

  // 3) Stars
  for (const starBody of world.stars) {
    const physics = world.starPhysics.find((p) => p.id === starBody.id);
    if (!physics) continue;

    const existingV = existingVelocitiesById?.get(starBody.id);
    const velocity: Vec3 = existingV
      ? { ...existingV }
      : { ...starBody.velocity };

    bodies.push({
      id: starBody.id,
      mass: physics.mass,
      position: starBody.position,
      velocity,
    });
  }

  return bodies;
}
