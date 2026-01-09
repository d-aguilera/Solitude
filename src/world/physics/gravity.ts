import { getGravitatingBodies } from "./gravityBodies.js";
import { NEWTON_G, SOFTENING_LENGTH } from "./gravityConfig.js";
import type {
  BodyId,
  BodyState,
  GravityState,
  Vec3,
  WorldState,
} from "../../world/types.js";
import { vec } from "../../world/vec3.js";
import { getBodyPosition, setBodyPosition } from "../../world/worldLookup.js";

/**
 * Attach or update gravity state on the world. This function ensures that for
 * every gravitating plane and planet-like body there is exactly one BodyState.
 */
export function ensureGravityState(
  world: WorldState,
  gravity: GravityState | null
): GravityState {
  const existingVelocitiesById = new Map<BodyId, Vec3>();

  if (gravity) {
    for (const b of gravity.bodies) {
      existingVelocitiesById.set(b.id, { ...b.velocity });
    }
  }

  // Derive current gravitating bodies from world + previous velocities.
  const gravBodies = getGravitatingBodies(world, existingVelocitiesById);

  const bodies: BodyState[] = gravBodies.map((g) => ({
    id: g.id,
    mass: g.mass,
    velocity: { ...g.velocity }, // single, intentional clone
  }));

  return { bodies };
}

/**
 * Compute gravitational accelerations for each body, given their positions.
 */
function computeGravityAccelerations(
  bodies: BodyState[],
  positions: Vec3[]
): Vec3[] {
  const n = bodies.length;
  const accelerations: Vec3[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const pi = positions[i];

    // Start with zero acceleration vector
    let a: Vec3 = { x: 0, y: 0, z: 0 };

    for (let j = 0; j < n; j++) {
      if (i === j) continue;

      const bj = bodies[j];
      const pj = positions[j];

      // Direction from i -> j
      const d = vec.sub(pj, pi);

      // Softened distance magnitude
      const r = Math.sqrt(vec.dot(d, d) + SOFTENING_LENGTH * SOFTENING_LENGTH);
      if (r === 0) continue;

      // a_i += G * m_j / r^3 * d
      const invR3 = 1 / (r * r * r);
      const scale = NEWTON_G * bj.mass * invR3;

      a = vec.add(a, vec.scale(d, scale));
    }

    accelerations[i] = a;
  }

  return accelerations;
}

/**
 * Integrate velocities using accelerations over dtSeconds.
 */
function integrateBodyVelocities(
  bodies: BodyState[],
  accelerations: Vec3[],
  dtSeconds: number
): void {
  const n = bodies.length;
  for (let i = 0; i < n; i++) {
    // v = v + a * dt
    const dv = vec.scale(accelerations[i], dtSeconds);
    const body = bodies[i];
    body.velocity = vec.add(body.velocity, dv);
  }
}

/**
 * Integrate positions using velocities over dtSeconds and write back
 * into world via the adapter. The integration math itself is
 * independent of how positions are stored.
 */
function integrateBodyPositions(
  bodies: BodyState[],
  positions: Vec3[],
  dtSeconds: number,
  world: WorldState
): void {
  const n = bodies.length;
  for (let i = 0; i < n; i++) {
    const b = bodies[i];
    const p = positions[i];
    const v = b.velocity;

    // p_new = p + v * dt
    const newPos: Vec3 = vec.add(p, vec.scale(v, dtSeconds));

    setBodyPosition(world, b.id, newPos);
  }
}

/**
 * Adapter: copy velocities from BodyState back to the plane objects so
 * renderers/HUD can use them. This keeps "plane.speed" in sync with the
 * underlying physics velocity magnitude.
 */
function syncBodyVelocitiesToPlanes(
  bodies: BodyState[],
  world: WorldState
): void {
  for (const plane of world.planes) {
    const body = bodies.find((b) => b.id === plane.id);
    if (!body) continue;
    const velocity = body.velocity;
    plane.velocity = { ...velocity };
    plane.speed = Math.hypot(velocity.x, velocity.y, velocity.z);
  }
}

/**
 * Orchestrates gravitational integration for one timestep.
 *
 * Responsibilities kept here:
 *  - Snapshot world positions into a local array
 *  - Run pure gravity integration (accelerations & velocity updates)
 *  - Integrate positions back into world via adapters
 *  - Sync plane velocity/speed from BodyState
 */
export function applyGravity(
  dtSeconds: number,
  world: WorldState,
  gravity: GravityState
): void {
  if (dtSeconds <= 0) return;

  const bodies = gravity.bodies;
  const n = bodies.length;
  if (n === 0) return;

  // Snapshot current positions
  const positions: Vec3[] = new Array(n);
  for (let i = 0; i < n; i++) {
    positions[i] = getBodyPosition(world, bodies[i].id);
  }

  // 1) Gravity
  const accelerations = computeGravityAccelerations(bodies, positions);
  integrateBodyVelocities(bodies, accelerations, dtSeconds);

  // 2) Integrate positions
  integrateBodyPositions(bodies, positions, dtSeconds, world);

  // 3) Sync body velocities back to planes
  syncBodyVelocitiesToPlanes(bodies, world);
}
