import { NEWTON_G, SOFTENING_LENGTH } from "./gravityConfig.js";
import type {
  BodyState,
  GravityBodyBinding,
  GravityState,
  Vec3,
  DomainWorld,
} from "../../world/domain.js";
import { vec } from "../../world/vec3.js";

function buildGravityBindings(world: DomainWorld): GravityBodyBinding[] {
  const bindings: GravityBodyBinding[] = [];

  // Planes
  for (let i = 0; i < world.planes.length; i++) {
    const plane = world.planes[i];
    bindings.push({
      id: plane.id,
      kind: "plane",
      planeIndex: i,
      planetIndex: -1,
      starIndex: -1,
    });
  }

  // Planets
  for (let i = 0; i < world.planets.length; i++) {
    const planet = world.planets[i];
    bindings.push({
      id: planet.id,
      kind: "planet",
      planeIndex: -1,
      planetIndex: i,
      starIndex: -1,
    });
  }

  // Stars
  for (let i = 0; i < world.stars.length; i++) {
    const star = world.stars[i];
    bindings.push({
      id: star.id,
      kind: "star",
      planeIndex: -1,
      planetIndex: -1,
      starIndex: i,
    });
  }

  return bindings;
}

function getPositionFromBinding(
  world: DomainWorld,
  binding: GravityBodyBinding
): Vec3 {
  switch (binding.kind) {
    case "plane":
      return world.planes[binding.planeIndex].position;
    case "planet":
      return world.planets[binding.planetIndex].position;
    case "star":
      return world.stars[binding.starIndex].position;
  }
}

function setPositionFromBinding(
  world: DomainWorld,
  binding: GravityBodyBinding,
  pos: Vec3
): void {
  switch (binding.kind) {
    case "plane": {
      const p = world.planes[binding.planeIndex];
      p.position = pos;
      break;
    }
    case "planet": {
      const b = world.planets[binding.planetIndex];
      b.position = pos;
      break;
    }
    case "star": {
      const b = world.stars[binding.starIndex];
      b.position = pos;
      break;
    }
  }
}

/**
 * Create a brand-new GravityState from the current world contents.
 * Should be called once at setup time, or if entities are added/removed.
 */
export function buildInitialGravityState(
  world: DomainWorld,
  mainPlaneId: string
): GravityState {
  const bindings = buildGravityBindings(world);
  const bodies: BodyState[] = [];

  const planeMass = 5e4;

  // Planes
  for (let i = 0; i < world.planes.length; i++) {
    const plane = world.planes[i];
    bodies.push({
      id: plane.id,
      mass: planeMass,
      velocity: { ...plane.velocity },
    });
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
  }

  const mainPlaneBodyIndex = bodies.findIndex((b) => b.id === mainPlaneId);
  if (mainPlaneBodyIndex === -1) {
    throw new Error(
      `buildInitialGravityState: main plane body not found for id=${mainPlaneId}`
    );
  }

  return { bodies, bindings, mainPlaneBodyIndex };
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
  world: DomainWorld,
  bindings: GravityBodyBinding[]
): void {
  const n = bodies.length;
  for (let i = 0; i < n; i++) {
    const b = bodies[i];
    const p = positions[i];
    const v = b.velocity;

    // p_new = p + v * dt
    const newPos: Vec3 = vec.add(p, vec.scale(v, dtSeconds));
    setPositionFromBinding(world, bindings[i], newPos);
  }
}

/**
 * Adapter: copy velocities from BodyState back to the plane objects so
 * renderers/HUD can use them. This keeps "plane.speed" in sync with the
 * underlying physics velocity magnitude.
 */
function syncBodyVelocitiesToPlanes(
  bodies: BodyState[],
  world: DomainWorld
): void {
  for (const plane of world.planes) {
    const body = bodies.find((b) => b.id === plane.id);
    if (!body) continue;
    const velocity = body.velocity;
    plane.velocity = { ...velocity };
  }
}

/**
 * Orchestrates gravitational integration for one timestep.
 *
 * Responsibilities kept here:
 *  - Snapshot world positions into a local array
 *  - Run pure gravity integration (accelerations & velocity updates)
 *  - Integrate positions back into world via adapters
 *  - Sync plane velocity from BodyState
 */
export function applyGravity(
  dtSeconds: number,
  world: DomainWorld,
  gravity: GravityState
): void {
  if (dtSeconds <= 0) return;

  const bodies = gravity.bodies;
  const bindings = gravity.bindings;
  const n = bodies.length;
  if (n === 0) return;

  // Snapshot current positions from bindings
  const positions: Vec3[] = new Array(n);
  for (let i = 0; i < n; i++) {
    positions[i] = getPositionFromBinding(world, bindings[i]);
  }

  // 1) Gravity
  const accelerations = computeGravityAccelerations(bodies, positions);
  integrateBodyVelocities(bodies, accelerations, dtSeconds);

  // 2) Integrate positions back into world via bindings
  integrateBodyPositions(bodies, positions, dtSeconds, world, bindings);

  // 3) Sync body velocities back to planes
  syncBodyVelocitiesToPlanes(bodies, world);
}
