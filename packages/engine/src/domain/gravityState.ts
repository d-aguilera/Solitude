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

  for (let i = 0; i < world.gravityMasses.length; i++) {
    const body = world.gravityMasses[i];
    bodyStates.push({
      id: body.id,
      mass: body.mass,
      velocity: body.state.velocity, // alias for performance
    });
    positions.push(body.state.position); // alias for performance
  }

  return { bodyStates, positions };
}
