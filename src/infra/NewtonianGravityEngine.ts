import type {
  BodyState,
  GravityEngine,
  GravityState,
  Vec3,
} from "../domain/domainPorts.js";
import { vec3 } from "../domain/vec3.js";

/**
 * Concrete GravityEngine using a Newtonian N-body implementation.
 */
export class NewtonianGravityEngine implements GravityEngine {
  constructor(
    private G: number,
    private softeningLength: number,
  ) {}
  /**
   * Advance gravity simulation by dtSeconds, returning a new GravityState.
   */
  step(dtSeconds: number, state: GravityState): void {
    if (dtSeconds == 0) {
      return;
    }

    const { bodies, positions } = state;

    if (bodies.length === 0) {
      return;
    }

    const accelerations = this.computeGravityAccelerations(bodies, positions);

    this.integrateBodyVelocities(bodies, accelerations, dtSeconds);

    this.integrateBodyPositions(bodies, positions, dtSeconds);
  }

  /**
   * Compute gravitational accelerations for each body, given their positions.
   */
  private computeGravityAccelerations(
    bodies: BodyState[],
    positions: Vec3[],
  ): Vec3[] {
    const n = bodies.length;
    const accelerations: Vec3[] = new Array(n);

    for (let i = 0; i < n; i++) {
      const pi = positions[i];

      const a: Vec3 = { x: 0, y: 0, z: 0 };

      for (let j = 0; j < n; j++) {
        if (i === j) continue;

        const d = vec3.sub(positions[j], pi);

        const r = Math.sqrt(
          vec3.dot(d, d) + this.softeningLength * this.softeningLength,
        );

        if (r === 0) continue;

        const invR3 = 1 / (r * r * r);
        const scale = this.G * bodies[j].mass * invR3;

        vec3.addInto(a, a, vec3.scale(d, scale));
      }

      accelerations[i] = a;
    }

    return accelerations;
  }

  /**
   * Integrate velocities using accelerations over dtSeconds.
   */
  private integrateBodyVelocities(
    bodies: BodyState[],
    accelerations: Vec3[],
    dtSeconds: number,
  ): void {
    const n = bodies.length;

    for (let i = 0; i < n; i++) {
      const dv = vec3.scale(accelerations[i], dtSeconds);
      const v = bodies[i].velocity;
      vec3.addInto(v, v, dv);
    }
  }

  /**
   * Integrate positions using velocities over dtSeconds.
   */
  private integrateBodyPositions(
    bodies: BodyState[],
    positions: Vec3[],
    dtSeconds: number,
  ): void {
    const n = bodies.length;
    positions.length = n;

    for (let i = 0; i < n; i++) {
      const pos = positions[i];
      vec3.addInto(pos, pos, vec3.scale(bodies[i].velocity, dtSeconds));
    }
  }
}
