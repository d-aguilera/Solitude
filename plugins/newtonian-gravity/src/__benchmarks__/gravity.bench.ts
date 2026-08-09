import type {
  ExternalGravityBodyState,
  ExternalGravityEngine,
  ExternalGravityState,
} from "@solitude/plugin-api/gravity";
import { vec3, type Vec3 } from "@solitude/plugin-api/math";
import { bench, describe } from "vitest";
import { NewtonianGravityEngine } from "../index";

const G = 6.6743e-11;

for (const bodyCount of [10, 32, 128]) {
  describe(`${bodyCount} bodies, one leapfrog step`, () => {
    const objectState = createState(bodyCount);
    const typedState = createState(bodyCount);
    const objectEngine = new ObjectVectorGravityEngine();
    const typedEngine = new NewtonianGravityEngine(G, 1, 10);

    bench("object-vector workspace", () => {
      objectEngine.step(0.01, objectState);
    });

    bench("production typed-array workspace", () => {
      typedEngine.step(0.01, typedState);
    });
  });
}

describe("10 bodies, bounded high-warp interval", () => {
  const state = createState(10);
  const engine = new NewtonianGravityEngine(G, 1, 10);

  bench("100 simulated seconds / 10 substeps", () => {
    engine.step(100, state);
  });
});

function createState(bodyCount: number): ExternalGravityState {
  const bodyStates: ExternalGravityBodyState[] = [];
  const positions: Vec3[] = [];
  for (let i = 0; i < bodyCount; i++) {
    bodyStates.push({
      mass: 1e20 + i * 1e18,
      velocity: vec3.create(0, 1 + i * 0.01, 0),
    });
    positions.push(
      vec3.create(
        1e8 + i * 2e7,
        ((i * 7919) % bodyCount) * 1e7,
        ((i * 104729) % bodyCount) * 1e6,
      ),
    );
  }
  return { bodyStates, positions };
}

/** The pre-optimization implementation retained only as a benchmark baseline. */
class ObjectVectorGravityEngine implements ExternalGravityEngine {
  private readonly accelerations: Vec3[] = [];
  private readonly scratchD = vec3.zero();
  private readonly scratchScaled = vec3.zero();
  private readonly scratchDelta = vec3.zero();

  step(dtSeconds: number, state: ExternalGravityState): void {
    this.computeAccelerations(state);
    this.kick(state.bodyStates, dtSeconds * 0.5);
    this.drift(state, dtSeconds);
    this.computeAccelerations(state);
    this.kick(state.bodyStates, dtSeconds * 0.5);
  }

  private computeAccelerations(state: ExternalGravityState): void {
    const bodyCount = state.bodyStates.length;
    while (this.accelerations.length < bodyCount) {
      this.accelerations.push(vec3.zero());
    }
    this.accelerations.length = bodyCount;
    for (let i = 0; i < bodyCount; i++) {
      const acceleration = this.accelerations[i];
      acceleration.x = 0;
      acceleration.y = 0;
      acceleration.z = 0;
    }
    for (let i = 0; i < bodyCount; i++) {
      const accelerationI = this.accelerations[i];
      const massI = state.bodyStates[i].mass;
      for (let j = i + 1; j < bodyCount; j++) {
        vec3.subInto(this.scratchD, state.positions[j], state.positions[i]);
        const radiusSq = vec3.dot(this.scratchD, this.scratchD) + 1;
        const inverseRadius = 1 / Math.sqrt(radiusSq);
        const inverseRadiusCubed =
          inverseRadius * inverseRadius * inverseRadius;
        vec3.scaleInto(
          this.scratchScaled,
          G * state.bodyStates[j].mass * inverseRadiusCubed,
          this.scratchD,
        );
        vec3.addInto(accelerationI, accelerationI, this.scratchScaled);
        vec3.scaleInto(
          this.scratchScaled,
          G * massI * inverseRadiusCubed,
          this.scratchD,
        );
        vec3.subInto(
          this.accelerations[j],
          this.accelerations[j],
          this.scratchScaled,
        );
      }
    }
  }

  private kick(bodies: ExternalGravityBodyState[], dtSeconds: number): void {
    for (let i = 0; i < bodies.length; i++) {
      vec3.scaleInto(this.scratchDelta, dtSeconds, this.accelerations[i]);
      vec3.addInto(bodies[i].velocity, bodies[i].velocity, this.scratchDelta);
    }
  }

  private drift(state: ExternalGravityState, dtSeconds: number): void {
    for (let i = 0; i < state.bodyStates.length; i++) {
      vec3.scaleInto(
        this.scratchDelta,
        dtSeconds,
        state.bodyStates[i].velocity,
      );
      vec3.addInto(state.positions[i], state.positions[i], this.scratchDelta);
    }
  }
}
