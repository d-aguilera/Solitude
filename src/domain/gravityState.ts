import type { BodyState, GravityState, World } from "./domainPorts";
import type { Vec3 } from "./vec3";

/**
 * Create a brand-new GravityState from the current world contents.
 * Call this once at setup time, or if entities are added/removed.
 *
 * The resulting GravityState contains:
 *  - bodies with mass and velocity
 *  - positions array with the current world positions
 */
export function buildInitialGravityState(world: World): GravityState {
  const bodyStates: BodyState[] = [];
  const positions: Vec3[] = [];

  // Ships
  for (let i = 0; i < world.ships.length; i++) {
    const ship = world.ships[i];
    bodyStates.push({
      id: ship.id,
      mass: 5e4, // arbitrary
      velocity: ship.velocity, // alias for performance
    });
    positions.push(ship.position); // alias for performance
  }

  // Planets
  for (let i = 0; i < world.planets.length; i++) {
    const body = world.planets[i];
    const physics = world.planetPhysics.find((p) => p.id === body.id);
    if (!physics) continue;

    bodyStates.push({
      id: body.id,
      mass: physics.mass,
      velocity: body.velocity, // alias for performance
    });
    positions.push(body.position); // alias for performance
  }

  // Stars
  for (let i = 0; i < world.stars.length; i++) {
    const body = world.stars[i];
    const physics = world.starPhysics.find((p) => p.id === body.id);
    if (!physics) continue;

    bodyStates.push({
      id: body.id,
      mass: physics.mass,
      velocity: body.velocity, // alias for performance
    });
    positions.push(body.position); // alias for performance
  }

  return { bodyStates, positions };
}
