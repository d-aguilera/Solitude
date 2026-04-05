import type {
  BodyState,
  GravityEngine,
  GravityState,
} from "../domain/domainPorts";
import { type Vec3, vec3 } from "../domain/vec3";

const accelerations: Vec3[] = [];

// Scratch vectors reused during force accumulation.
const scratchD: Vec3 = vec3.zero();
const scratchScaled: Vec3 = vec3.zero();

// Scratch vectors reused during integration.
const scratchDeltaPos: Vec3 = vec3.zero();
const scratchDeltaVel: Vec3 = vec3.zero();

/**
 * Concrete GravityEngine using a Newtonian N-body implementation.
 */
export class NewtonianGravityEngine implements GravityEngine {
  constructor(
    private G: number,
    private softeningLength: number,
  ) {}
  /**
   * Advance gravity simulation by dtSeconds using a leapfrog
   * (kick-drift-kick) integrator for better orbital stability.
   */
  step(dtSeconds: number, state: GravityState): void {
    if (dtSeconds == 0) {
      return;
    }

    const { bodyStates, positions } = state;

    if (bodyStates.length === 0) {
      return;
    }

    // Kick (half step)
    this.computeGravityAccelerations(bodyStates, positions);
    this.kickBodyVelocities(bodyStates, dtSeconds * 0.5);

    // Drift (full step) using half-step velocities
    this.driftBodyPositions(bodyStates, positions, dtSeconds);

    // Kick (half step) with updated accelerations
    this.computeGravityAccelerations(bodyStates, positions);
    this.kickBodyVelocities(bodyStates, dtSeconds * 0.5);
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

    // Reset all accelerations once, then accumulate pair interactions.
    for (let i = 0; i < n; i++) {
      const a = accelerations[i];
      a.x = 0;
      a.y = 0;
      a.z = 0;
    }

    const softeningLengthSq = this.softeningLength * this.softeningLength;

    // Compute each pair (i, j) exactly once and update both bodies.
    for (let i = 0; i < n; i++) {
      const pi = positions[i];
      const ai = accelerations[i];
      const mi = bodies[i].mass;

      for (let j = i + 1; j < n; j++) {
        vec3.subInto(scratchD, positions[j], pi);

        const r2 = vec3.dot(scratchD, scratchD) + softeningLengthSq;
        if (r2 === 0) continue;

        const invR = 1 / Math.sqrt(r2);
        const invR3 = invR * invR * invR;

        // a_i += G * m_j / r^3 * d
        const scaleI = this.G * bodies[j].mass * invR3;
        vec3.scaleInto(scratchScaled, scaleI, scratchD);
        vec3.addInto(ai, ai, scratchScaled);

        // a_j -= G * m_i / r^3 * d
        const aj = accelerations[j];
        const scaleJ = this.G * mi * invR3;
        vec3.scaleInto(scratchScaled, scaleJ, scratchD);
        vec3.subInto(aj, aj, scratchScaled);
      }
    }
  }

  /**
   * Kick velocities using accelerations over dtSeconds.
   */
  private kickBodyVelocities(bodies: BodyState[], dtSeconds: number): void {
    const n = bodies.length;

    for (let i = 0; i < n; i++) {
      const a = accelerations[i];
      const v = bodies[i].velocity;
      vec3.scaleInto(scratchDeltaVel, dtSeconds, a);
      vec3.addInto(v, v, scratchDeltaVel);
    }
  }

  /**
   * Drift positions using current velocities over dtSeconds.
   */
  private driftBodyPositions(
    bodies: BodyState[],
    positions: Vec3[],
    dtSeconds: number,
  ): void {
    const n = bodies.length;

    for (let i = 0; i < n; i++) {
      const pos = positions[i];
      const v = bodies[i].velocity;

      // scratchDeltaPos = v * dtSeconds
      vec3.scaleInto(scratchDeltaPos, dtSeconds, v);

      // pos += scratchDeltaPos
      vec3.addInto(pos, pos, scratchDeltaPos);
    }
  }
}
