import { NEWTON_G, SOFTENING_LENGTH } from "./gravityConfig.js";
import { applyThrustToPlaneVelocity } from "./controls.js";
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
    if (obj.mesh.objectType.startsWith("planet")) {
      const radius = obj.scale;
      const density = 5500; // kg/m^3 - Earth-like-ish
      const volume = (4 / 3) * Math.PI * radius * radius * radius;
      const mass = density * volume;

      upsertBody(obj.id, mass);
    }
  }

  return { bodies };
}

export function applyGravityAndThrust(
  dtSeconds: number,
  world: WorldState,
  scene: Scene,
  gravity: GravityState,
  controlledPlaneId: string,
  planeInputBurn: boolean
): void {
  if (dtSeconds <= 0) return;
  const bodies = gravity.bodies;
  const n = bodies.length;
  if (n === 0) return;

  const positions: Vec3[] = new Array(n);

  const getPosition = (id: BodyId): Vec3 => {
    const plane = world.planes.find((p) => p.id === id);
    if (plane) return plane.position;

    const obj = scene.objects.find((o) => o.id === id);
    if (!obj) {
      throw new Error(`Body position not found for id=${id}`);
    }
    return obj.position;
  };

  for (let i = 0; i < n; i++) {
    positions[i] = getPosition(bodies[i].id);
  }

  const accelerations: Vec3[] = new Array(n);
  for (let i = 0; i < n; i++) {
    accelerations[i] = { x: 0, y: 0, z: 0 };
  }

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

    accelerations[i].x = ax;
    accelerations[i].y = ay;
    accelerations[i].z = az;
  }

  // Apply gravity accelerations to velocities
  for (let i = 0; i < n; i++) {
    const b = bodies[i];
    const a = accelerations[i];

    b.velocity.x += a.x * dtSeconds;
    b.velocity.y += a.y * dtSeconds;
    b.velocity.z += a.z * dtSeconds;
  }

  // Apply thrust to the controlled plane, modifying its body's velocity
  if (planeInputBurn) {
    const plane = world.planes.find((p) => p.id === controlledPlaneId);
    if (!plane) {
      throw new Error(`Controlled plane not found: ${controlledPlaneId}`);
    }
    const body = bodies.find((b) => b.id === controlledPlaneId);
    if (!body) {
      throw new Error(`BodyState for plane not found: ${controlledPlaneId}`);
    }
    applyThrustToPlaneVelocity(
      dtSeconds,
      { burn: true } as any,
      body.velocity,
      plane
    );
  }

  const setPosition = (id: BodyId, newPos: Vec3): void => {
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
  };

  for (let i = 0; i < n; i++) {
    const b = bodies[i];
    const p = positions[i];
    const v = b.velocity;

    const newPos: Vec3 = {
      x: p.x + v.x * dtSeconds,
      y: p.y + v.y * dtSeconds,
      z: p.z + v.z * dtSeconds,
    };

    setPosition(b.id, newPos);
  }

  // Copy velocities back to planes so renderers can use them
  for (const plane of world.planes) {
    const body = bodies.find((b) => b.id === plane.id);
    if (body) {
      plane.velocity = {
        x: body.velocity.x,
        y: body.velocity.y,
        z: body.velocity.z,
      };
      // Optionally keep plane.speed coherent with velocity magnitude
      const speed = Math.hypot(
        body.velocity.x,
        body.velocity.y,
        body.velocity.z
      );
      plane.speed = speed;
    }
  }
}
