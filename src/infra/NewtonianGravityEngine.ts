import type {
  BodyState,
  GravityEngine,
  GravityState,
  Vec3,
} from "../domain/domainPorts.js";
import { vec3 } from "../domain/vec3.js";

const accelerations: Vec3[] = [];

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

    this.computeGravityAccelerations(bodies, positions);

    this.integrateBodyVelocities(bodies, dtSeconds);

    this.integrateBodyPositions(bodies, positions, dtSeconds);
  }

  /**
   * Compute gravitational accelerations for each body, given their positions.
   */
  private computeGravityAccelerations(
    bodies: BodyState[],
    positions: Vec3[],
  ): void {
    const n = bodies.length;

    if (accelerations.length < n) {
      for (let i = accelerations.length; i < n; i++) {
        accelerations.push(vec3.zero());
      }
    } else {
      accelerations.length = n;
    }

    for (let i = 0; i < n; i++) {
      const pi = positions[i];

      const a: Vec3 = accelerations[i];
      a.x = 0;
      a.y = 0;
      a.z = 0;

      for (let j = 0; j < n; j++) {
        if (i === j) continue;

        const d = vec3.sub(positions[j], pi);

        const r = Math.sqrt(
          vec3.dot(d, d) + this.softeningLength * this.softeningLength,
        );

        if (r === 0) continue;

        const invR3 = 1 / (r * r * r);
        const scale = this.G * bodies[j].mass * invR3;

        vec3.addInto(a, a, vec3.scaleInto(d, scale, d));
      }
    }
  }

  /**
   * Integrate velocities using accelerations over dtSeconds.
   */
  private integrateBodyVelocities(
    bodies: BodyState[],
    dtSeconds: number,
  ): void {
    const n = bodies.length;

    for (let i = 0; i < n; i++) {
      const a = accelerations[i];
      const v = bodies[i].velocity;
      vec3.addInto(v, v, vec3.scaleInto(a, dtSeconds, a));
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
      const v = bodies[i].velocity;
      vec3.addInto(pos, pos, vec3.scale(v, dtSeconds));
    }
  }
}
