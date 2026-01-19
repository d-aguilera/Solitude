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
 */
export class NewtonianGravityEngine implements GravityEngine {
  buildInitialState(world: DomainWorld): GravityState {
    return this.buildInitialGravityState(world);
  }

  step(
    dtSeconds: number,
    world: DomainWorld,
    state: GravityState,
  ): { nextState: GravityState; positions: Vec3[] } {
    return this.applyGravity(dtSeconds, world, state);
  }

  buildGravityBindings(world: DomainWorld): GravityBodyBinding[] {
    const bindings: GravityBodyBinding[] = [];

    // Ships
    for (let i = 0; i < world.shipBodies.length; i++) {
      const ship = world.shipBodies[i];
      bindings.push({
        id: ship.id,
        kind: "ship",
        shipIndex: i,
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
        shipIndex: -1,
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
        shipIndex: -1,
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
      case "ship":
        return world.shipBodies[binding.shipIndex].position;
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
      case "ship": {
        const p = world.shipBodies[binding.shipIndex];
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

    const shipMass = 5e4;

    // Ships
    for (let i = 0; i < world.shipBodies.length; i++) {
      const ship = world.shipBodies[i];
      bodies.push({
        id: ship.id,
        mass: shipMass,
        velocity: { ...ship.velocity },
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
   * Integrate positions using velocities over dtSeconds and return the
   * updated positions. Outer layers are responsible for applying these
   * positions back into their own world representation.
   */
  integrateBodyPositions(
    bodies: BodyState[],
    positions: Vec3[],
    dtSeconds: number,
  ): Vec3[] {
    const n = bodies.length;
    const nextPositions: Vec3[] = new Array(n);

    for (let i = 0; i < n; i++) {
      const b = bodies[i];
      const p = positions[i];
      const v = b.velocity;

      nextPositions[i] = vec3.add(p, vec3.scale(v, dtSeconds));
    }

    return nextPositions;
  }

  /**
   * Orchestrates gravitational integration for one timestep, without mutating
   * the provided DomainWorld.
   */
  applyGravity(
    dtSeconds: number,
    world: DomainWorld,
    gravity: GravityState,
  ): { nextState: GravityState; positions: Vec3[] } {
    if (dtSeconds <= 0) {
      return { nextState: gravity, positions: [] };
    }

    const bodies = gravity.bodies;
    const bindings = gravity.bindings;
    const n = bodies.length;
    if (n === 0) {
      return { nextState: gravity, positions: [] };
    }

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

    const nextPositions = this.integrateBodyPositions(
      nextBodies,
      positions,
      dtSeconds,
    );

    return {
      nextState: {
        bodies: nextBodies,
        bindings,
      },
      positions: nextPositions,
    };
  }
}
