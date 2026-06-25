import type {
  BodyState,
  GravityEngine,
  GravityState,
} from "../domain/domainPorts";
import { type Vec3, vec3 } from "../domain/vec3";

export interface NewtonianGravityWorkspace {
  accelerations: Vec3[];
  scratchD: Vec3;
  scratchScaled: Vec3;
  scratchDeltaPos: Vec3;
  scratchDeltaVel: Vec3;
}

export function createNewtonianGravityWorkspace(): NewtonianGravityWorkspace {
  return {
    accelerations: [],
    scratchD: vec3.zero(),
    scratchScaled: vec3.zero(),
    scratchDeltaPos: vec3.zero(),
    scratchDeltaVel: vec3.zero(),
  };
}

/**
 * Concrete GravityEngine using a Newtonian N-body implementation.
 */
export class NewtonianGravityEngine implements GravityEngine {
  constructor(
    private G: number,
    private softeningLength: number,
    private readonly workspace: NewtonianGravityWorkspace = createNewtonianGravityWorkspace(),
  ) {}
  /**
   * Advance gravity simulation by dtSeconds using a leapfrog
   * (kick-drift-kick) integrator for better orbital stability.
   */
  step(dtSeconds: number, state: GravityState): void {
    if (dtSeconds == 0) {
      return;
    }

    const bodyStates = state.bodyStates;
    const positions = state.positions;

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
    const workspace = this.workspace;
    const accelerations = workspace.accelerations;
    const scratchD = workspace.scratchD;
    const scratchScaled = workspace.scratchScaled;
    const n = bodies.length;

    if (accelerations.length < n) {
      for (let i = accelerations.length; i < n; i++) {
        accelerations.push(vec3.zero());
      }
    } else {
      accelerations.length = n;
    }

    // Reset all accelerations once, then accumulate pair interactions.
    let accel: Vec3;
    for (let i = 0; i < n; i++) {
      accel = accelerations[i];
      accel.x = 0;
      accel.y = 0;
      accel.z = 0;
    }

    const softeningLengthSq = this.softeningLength * this.softeningLength;

    let pi: Vec3;
    let ai: Vec3;
    let mi: number;

    // Compute each pair (i, j) exactly once and update both bodies.
    for (let i = 0; i < n; i++) {
      pi = positions[i];
      ai = accelerations[i];
      mi = bodies[i].mass;

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
    const accelerations = this.workspace.accelerations;
    const scratchDeltaVel = this.workspace.scratchDeltaVel;
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
    const scratchDeltaPos = this.workspace.scratchDeltaPos;
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
