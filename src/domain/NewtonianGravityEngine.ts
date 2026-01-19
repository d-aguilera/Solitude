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
  /**
   * Advance gravity simulation by dtSeconds, returning a new GravityState
   * and updated positions for each binding.
   */
  step(
    dtSeconds: number,
    world: DomainWorld,
    state: GravityState,
  ): { nextState: GravityState; positions: Vec3[] } {
    if (dtSeconds <= 0) {
      return { nextState: state, positions: [] };
    }

    const bodies = state.bodies;
    const n = bodies.length;
    if (n === 0) {
      return { nextState: state, positions: [] };
    }

    const bindings = state.bindings;
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
}
