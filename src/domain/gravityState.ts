import type { BodyState, GravityState, Vec3, World } from "./domainPorts";

/**
 * Create a brand-new GravityState from the current world contents.
 * Call this once at setup time, or if entities are added/removed.
 *
 * The resulting GravityState contains:
 *  - bindings that associate each gravity body with a world entity
 *  - bodies with mass and velocity
 *  - positions array with the current world positions
 */
export function buildInitialGravityState(world: World): GravityState {
  const bodies: BodyState[] = [];
  const positions: Vec3[] = [];

  const shipMass = 5e4;

  // Ships
  for (let i = 0; i < world.shipBodies.length; i++) {
    const ship = world.shipBodies[i];
    bodies.push({
      id: ship.id,
      mass: shipMass,
      velocity: { ...ship.velocity },
    });
    positions.push({ ...ship.position });
  }

  // Planets
  for (let i = 0; i < world.planets.length; i++) {
    const body = world.planets[i];
    const physics = world.planetPhysics.find((p) => p.id === body.id);
    if (!physics) continue;

    bodies.push({
      id: body.id,
      mass: physics.mass,
      velocity: { ...body.velocity },
    });
    positions.push({ ...body.position });
  }

  // Stars
  for (let i = 0; i < world.stars.length; i++) {
    const body = world.stars[i];
    const physics = world.starPhysics.find((p) => p.id === body.id);
    if (!physics) continue;

    bodies.push({
      id: body.id,
      mass: physics.mass,
      velocity: { ...body.velocity },
    });
    positions.push({ ...body.position });
  }

  return { bodies, positions };
}
