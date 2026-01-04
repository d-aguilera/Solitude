import { NEWTON_G, SOFTENING_LENGTH } from "./gravityConfig.js";
import type {
  BodyId,
  BodyState,
  GravityState,
  Scene,
  Vec3,
  WorldState,
} from "./types.js";

/**
 * Attach or update gravity state on the world. This function ensures that for
 * every plane and every planet-like SceneObject there is exactly one BodyState.
 */
export function ensureGravityState(
  world: WorldState,
  scene: Scene,
  gravity: GravityState | null
): GravityState {
  const byId: Map<BodyId, BodyState> = new Map();

  if (gravity) {
    for (const b of gravity.bodies) {
      // Copy so callers can mutate the returned GravityState freely
      byId.set(b.id, { ...b });
    }
  }

  const bodies: BodyState[] = [];

  const upsertBody = (id: BodyId, mass: number): BodyState => {
    const existing = byId.get(id);
    if (existing) {
      existing.mass = mass;
      bodies.push(existing);
      return existing;
    }
    const created: BodyState = {
      id,
      mass,
      velocity: { x: 0, y: 0, z: 0 },
    };
    bodies.push(created);
    return created;
  };

  // Planes: give them a plausible mass
  for (const plane of world.planes) {
    const mass = 5e4;
    upsertBody(plane.id, mass);
  }

  // Planets: all SceneObjects whose mesh.objectType starts with "planet"
  for (const obj of scene.objects) {
    if (!obj.mesh.objectType.startsWith("planet")) continue;

    const radius = obj.scale;
    const density = 5.5e7; // 10^4 times denser than Earth-like for gameplay
    const volume = (4 / 3) * Math.PI * radius * radius * radius;
    const mass = density * volume;

    const body = upsertBody(obj.id, mass);

    // If this body is newly created (velocity still zero) and the SceneObject
    // provides an initialVelocity, use that to seed the BodyState.
    const hasZeroVelocity =
      body.velocity.x === 0 && body.velocity.y === 0 && body.velocity.z === 0;

    if (hasZeroVelocity && obj.initialVelocity) {
      body.velocity = { ...obj.initialVelocity };
    }
  }

  return { bodies };
}

/**
 * Adapter: compute the world-space position of a body (plane or scene object).
 */
function getBodyPosition(id: BodyId, world: WorldState, scene: Scene): Vec3 {
  const plane = world.planes.find((p) => p.id === id);
  if (plane) return plane.position;

  const obj = scene.objects.find((o) => o.id === id);
  if (!obj) {
    throw new Error(`Body position not found for id=${id}`);
  }
  return obj.position;
}

/**
 * Adapter: write a new position back into the world/scene for a body.
 */
function setBodyPosition(
  id: BodyId,
  newPos: Vec3,
  world: WorldState,
  scene: Scene
): void {
  const plane = world.planes.find((p) => p.id === id);
  if (plane) {
    plane.position = newPos;
    return;
  }
  const obj = scene.objects.find((o) => o.id === id);
  if (!obj) {
    throw new Error(`Body position target not found for id=${id}`);
  }
  obj.position = newPos;
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

      const dx = pj.x - pi.x;
      const dy = pj.y - pi.y;
      const dz = pj.z - pi.z;

      const distSq =
        dx * dx + dy * dy + dz * dz + SOFTENING_LENGTH * SOFTENING_LENGTH;
      const dist = Math.sqrt(distSq);

      const invDist3 = 1 / (distSq * dist);
      const factor = NEWTON_G * bj.mass * invDist3;

      ax += factor * dx;
      ay += factor * dy;
      az += factor * dz;
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
 * into world/scene via the adapter. The integration math itself is
 * independent of how positions are stored.
 */
function integrateBodyPositions(
  bodies: BodyState[],
  positions: Vec3[],
  dtSeconds: number,
  world: WorldState,
  scene: Scene
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

    setBodyPosition(b.id, newPos, world, scene);
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
 *  - Snapshot world/scene positions into a local array
 *  - Run pure gravity integration (accelerations & velocity updates)
 *  - Integrate positions back into world/scene via adapters
 *  - Sync plane velocity/speed from BodyState
 */
export function applyGravity(
  dtSeconds: number,
  world: WorldState,
  scene: Scene,
  gravity: GravityState
): void {
  if (dtSeconds <= 0) return;

  const bodies = gravity.bodies;
  const n = bodies.length;
  if (n === 0) return;

  // Snapshot current positions
  const positions: Vec3[] = new Array(n);
  for (let i = 0; i < n; i++) {
    positions[i] = getBodyPosition(bodies[i].id, world, scene);
  }

  // 1) Gravity
  const accelerations = computeGravityAccelerations(bodies, positions);
  integrateBodyVelocities(bodies, accelerations, dtSeconds);

  // 2) Integrate positions
  integrateBodyPositions(bodies, positions, dtSeconds, world, scene);

  // 3) Sync body velocities back to planes
  syncBodyVelocitiesToPlanes(bodies, world);
}
