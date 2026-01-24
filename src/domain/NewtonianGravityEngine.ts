import { NEWTON_G, SOFTENING_LENGTH } from "./domainInternals.js";
import type {
  BodyState,
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
   * Advance gravity simulation by dtSeconds, returning a new GravityState.
   */
  step(dtSeconds: number, state: GravityState): GravityState {
    if (dtSeconds <= 0) {
      return state;
    }

    const { bodies, positions } = state;

    if (bodies.length === 0) {
      return state;
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
      bodies: nextBodies,
      positions: nextPositions,
    };
  }

  /**
   * Compute gravitational accelerations for each body, given their positions.
   */
  computeGravityAccelerations(bodies: BodyState[], positions: Vec3[]): Vec3[] {
    const n = bodies.length;
    const accelerations: Vec3[] = new Array(n);

    for (let i = 0; i < n; i++) {
      const pi = positions[i];

      const a: Vec3 = { x: 0, y: 0, z: 0 };

      for (let j = 0; j < n; j++) {
        if (i === j) continue;

        const d = vec3.sub(positions[j], pi);

        const r = Math.sqrt(
          vec3.dot(d, d) + SOFTENING_LENGTH * SOFTENING_LENGTH,
        );

        if (r === 0) continue;

        const invR3 = 1 / (r * r * r);
        const scale = NEWTON_G * bodies[j].mass * invR3;

        vec3.addInto(a, a, vec3.scale(d, scale));
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
