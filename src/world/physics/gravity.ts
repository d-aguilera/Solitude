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

    let ax = 0;
    let ay = 0;
    let az = 0;

    for (let j = 0; j < n; j++) {
      if (i === j) continue;

      const bj = bodies[j];
      const pj = positions[j];

      const d = vec.sub(pj, pi);
      const distSq = vec.dot(d, d) + SOFTENING_LENGTH * SOFTENING_LENGTH;
      const dist = Math.sqrt(distSq);

      const invDist3 = 1 / (distSq * dist);
      const factor = NEWTON_G * bj.mass * invDist3;

      ax += factor * d.x;
      ay += factor * d.y;
      az += factor * d.z;
    }

    accelerations[i] = { x: ax, y: ay, z: az };
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
    const velocity = bodies[i].velocity;
    const a = accelerations[i];

    velocity.x += a.x * dtSeconds;
    velocity.y += a.y * dtSeconds;
    velocity.z += a.z * dtSeconds;
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

    const newPos: Vec3 = {
      x: p.x + v.x * dtSeconds,
      y: p.y + v.y * dtSeconds,
      z: p.z + v.z * dtSeconds,
    };

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
