import { NEWTON_G, SOFTENING_LENGTH } from "./domainInternals.js";
import type {
  BodyState,
  DomainWorld,
  GravityBodyBinding,
  GravityEngine,
  GravityState,
  Vec3,
} from "./domainPorts.js";
import { vec3 } from "./vec3.js";

/**
 * Concrete GravityEngine using a Newtonian N-body implementation.
 *
 * This implementation only depends on DomainWorld and domain math utilities.
 * It does not know about adapter-level world types or rendering.
 */
export class NewtonianGravityEngine implements GravityEngine {
  buildInitialState(world: DomainWorld): GravityState {
    return this.buildInitialGravityState(world);
  }

  step(
    dtSeconds: number,
    world: DomainWorld,
    state: GravityState,
  ): GravityState {
    return this.applyGravity(dtSeconds, world, state);
  }

  buildGravityBindings(world: DomainWorld): GravityBodyBinding[] {
    const bindings: GravityBodyBinding[] = [];

    // Planes
    for (let i = 0; i < world.planeBodies.length; i++) {
      const plane = world.planeBodies[i];
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

  getPositionFromBinding(
    world: DomainWorld,
    binding: GravityBodyBinding,
  ): Vec3 {
    switch (binding.kind) {
      case "plane":
        return world.planeBodies[binding.planeIndex].position;
      case "planet":
        return world.planets[binding.planetIndex].position;
      case "star":
        return world.stars[binding.starIndex].position;
    }
  }

  setPositionFromBinding(
    world: DomainWorld,
    binding: GravityBodyBinding,
    pos: Vec3,
  ): void {
    switch (binding.kind) {
      case "plane": {
        const p = world.planeBodies[binding.planeIndex];
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
   * Call this once at setup time, or if entities are added/removed.
   */
  buildInitialGravityState(world: DomainWorld): GravityState {
    const bindings = this.buildGravityBindings(world);
    const bodies: BodyState[] = [];

    const planeMass = 5e4;

    // Planes
    for (let i = 0; i < world.planeBodies.length; i++) {
      const plane = world.planeBodies[i];
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

    return { bodies, bindings };
  }

  /**
   * Compute gravitational accelerations for each body, given their positions.
   */
  computeGravityAccelerations(bodies: BodyState[], positions: Vec3[]): Vec3[] {
    const n = bodies.length;
    const accelerations: Vec3[] = new Array(n);

    for (let i = 0; i < n; i++) {
      const pi = positions[i];

      let a: Vec3 = { x: 0, y: 0, z: 0 };

      for (let j = 0; j < n; j++) {
        if (i === j) continue;

        const bj = bodies[j];
        const pj = positions[j];

        const d = vec3.sub(pj, pi);

        const r = Math.sqrt(
          vec3.dot(d, d) + SOFTENING_LENGTH * SOFTENING_LENGTH,
        );
        if (r === 0) continue;

        const invR3 = 1 / (r * r * r);
        const scale = NEWTON_G * bj.mass * invR3;

        a = vec3.add(a, vec3.scale(d, scale));
      }

      accelerations[i] = a;
    }

    return accelerations;
  }

  /**
   * Integrate velocities using accelerations over dtSeconds.
   */
  integrateBodyVelocities(
    bodies: BodyState[],
    accelerations: Vec3[],
    dtSeconds: number,
  ): BodyState[] {
    const n = bodies.length;
    const nextBodies: BodyState[] = new Array(n);

    for (let i = 0; i < n; i++) {
      const dv = vec3.scale(accelerations[i], dtSeconds);
      const body = bodies[i];
      const velocity = vec3.add(body.velocity, dv);

      nextBodies[i] = {
        id: body.id,
        mass: body.mass,
        velocity,
      };
    }

    return nextBodies;
  }

  /**
   * Integrate positions using velocities over dtSeconds and write back
   * into world via bindings. Position storage and any adapter-level
   * state are owned by outer layers.
   */
  integrateBodyPositionsIntoWorld(
    bodies: BodyState[],
    positions: Vec3[],
    dtSeconds: number,
    world: DomainWorld,
    bindings: GravityBodyBinding[],
  ): void {
    const n = bodies.length;
    for (let i = 0; i < n; i++) {
      const b = bodies[i];
      const p = positions[i];
      const v = b.velocity;

      const newPos: Vec3 = vec3.add(p, vec3.scale(v, dtSeconds));
      this.setPositionFromBinding(world, bindings[i], newPos);
    }
  }

  /**
   * Orchestrates gravitational integration for one timestep.
   */
  applyGravity(
    dtSeconds: number,
    world: DomainWorld,
    gravity: GravityState,
  ): GravityState {
    if (dtSeconds <= 0) return gravity;

    const bodies = gravity.bodies;
    const bindings = gravity.bindings;
    const n = bodies.length;
    if (n === 0) return gravity;

    const positions: Vec3[] = new Array(n);
    for (let i = 0; i < n; i++) {
      positions[i] = this.getPositionFromBinding(world, bindings[i]);
    }

    const accelerations = this.computeGravityAccelerations(bodies, positions);
    const nextBodies = this.integrateBodyVelocities(
      bodies,
      accelerations,
      dtSeconds,
    );

    this.integrateBodyPositionsIntoWorld(
      nextBodies,
      positions,
      dtSeconds,
      world,
      bindings,
    );

    return {
      bodies: nextBodies,
      bindings,
    };
  }
}
