import type {
  ExternalGravityBodyState,
  ExternalGravityEngine,
  ExternalGravityState,
} from "@solitude/plugin-api/gravity";
import { vec3, type Vec3 } from "@solitude/plugin-api/math";
import type { ExternalPlugin } from "@solitude/plugin-api/module";

const NEWTON_G = 6.6743e-11;
const SOFTENING_LENGTH_METERS = 1;

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

export class NewtonianGravityEngine implements ExternalGravityEngine {
  constructor(
    private readonly gravitationalConstant = NEWTON_G,
    private readonly softeningLength = SOFTENING_LENGTH_METERS,
    private readonly workspace: NewtonianGravityWorkspace = createNewtonianGravityWorkspace(),
  ) {}

  step(dtSeconds: number, state: ExternalGravityState): void {
    if (dtSeconds === 0) return;

    const bodyStates = state.bodyStates;
    const positions = state.positions;
    if (bodyStates.length === 0) return;

    this.computeGravityAccelerations(bodyStates, positions);
    this.kickBodyVelocities(bodyStates, dtSeconds * 0.5);
    this.driftBodyPositions(bodyStates, positions, dtSeconds);
    this.computeGravityAccelerations(bodyStates, positions);
    this.kickBodyVelocities(bodyStates, dtSeconds * 0.5);
  }

  private computeGravityAccelerations(
    bodies: ExternalGravityBodyState[],
    positions: Vec3[],
  ): void {
    const workspace = this.workspace;
    const accelerations = workspace.accelerations;
    const scratchD = workspace.scratchD;
    const scratchScaled = workspace.scratchScaled;
    const bodyCount = bodies.length;

    if (accelerations.length < bodyCount) {
      for (let i = accelerations.length; i < bodyCount; i++) {
        accelerations.push(vec3.zero());
      }
    } else {
      accelerations.length = bodyCount;
    }

    for (let i = 0; i < bodyCount; i++) {
      const acceleration = accelerations[i];
      acceleration.x = 0;
      acceleration.y = 0;
      acceleration.z = 0;
    }

    const softeningLengthSq = this.softeningLength * this.softeningLength;
    for (let i = 0; i < bodyCount; i++) {
      const positionI = positions[i];
      const accelerationI = accelerations[i];
      const massI = bodies[i].mass;

      for (let j = i + 1; j < bodyCount; j++) {
        vec3.subInto(scratchD, positions[j], positionI);
        const radiusSq = vec3.dot(scratchD, scratchD) + softeningLengthSq;
        if (radiusSq === 0) continue;

        const inverseRadius = 1 / Math.sqrt(radiusSq);
        const inverseRadiusCubed =
          inverseRadius * inverseRadius * inverseRadius;

        const scaleI =
          this.gravitationalConstant * bodies[j].mass * inverseRadiusCubed;
        vec3.scaleInto(scratchScaled, scaleI, scratchD);
        vec3.addInto(accelerationI, accelerationI, scratchScaled);

        const accelerationJ = accelerations[j];
        const scaleJ = this.gravitationalConstant * massI * inverseRadiusCubed;
        vec3.scaleInto(scratchScaled, scaleJ, scratchD);
        vec3.subInto(accelerationJ, accelerationJ, scratchScaled);
      }
    }
  }

  private kickBodyVelocities(
    bodies: ExternalGravityBodyState[],
    dtSeconds: number,
  ): void {
    const accelerations = this.workspace.accelerations;
    const scratchDeltaVel = this.workspace.scratchDeltaVel;
    for (let i = 0; i < bodies.length; i++) {
      const velocity = bodies[i].velocity;
      vec3.scaleInto(scratchDeltaVel, dtSeconds, accelerations[i]);
      vec3.addInto(velocity, velocity, scratchDeltaVel);
    }
  }

  private driftBodyPositions(
    bodies: ExternalGravityBodyState[],
    positions: Vec3[],
    dtSeconds: number,
  ): void {
    const scratchDeltaPos = this.workspace.scratchDeltaPos;
    for (let i = 0; i < bodies.length; i++) {
      const position = positions[i];
      vec3.scaleInto(scratchDeltaPos, dtSeconds, bodies[i].velocity);
      vec3.addInto(position, position, scratchDeltaPos);
    }
  }
}

export function createPlugin(): ExternalPlugin {
  return {
    id: "newtonianGravity",
    gravity: {
      createGravityEngine: () => new NewtonianGravityEngine(),
    },
  };
}
