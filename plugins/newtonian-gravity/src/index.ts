import type {
  ExternalGravityEngine,
  ExternalGravityState,
} from "@solitude/plugin-api/gravity";
import type { ExternalPlugin } from "@solitude/plugin-api/module";
import type { ExternalRuntimeOptions } from "@solitude/plugin-api/runtime";

const NEWTON_G = 6.6743e-11;
const SOFTENING_LENGTH_METERS = 1;
export const DEFAULT_MAX_GRAVITY_STEP_SECONDS = 10;
export const maxGravityStepSecondsRuntimeOption = "maxGravityStepSeconds";

export interface NewtonianGravityWorkspace {
  accelerations: Float64Array;
  masses: Float64Array;
  positions: Float64Array;
  velocities: Float64Array;
}

export function createNewtonianGravityWorkspace(
  bodyCapacity = 0,
): NewtonianGravityWorkspace {
  return {
    accelerations: new Float64Array(bodyCapacity * 3),
    masses: new Float64Array(bodyCapacity),
    positions: new Float64Array(bodyCapacity * 3),
    velocities: new Float64Array(bodyCapacity * 3),
  };
}

export class NewtonianGravityEngine implements ExternalGravityEngine {
  constructor(
    private readonly gravitationalConstant = NEWTON_G,
    private readonly softeningLength = SOFTENING_LENGTH_METERS,
    private readonly maxStepSeconds = DEFAULT_MAX_GRAVITY_STEP_SECONDS,
    private readonly workspace: NewtonianGravityWorkspace = createNewtonianGravityWorkspace(),
  ) {
    requirePositiveFiniteMaxStep(maxStepSeconds);
  }

  step(dtSeconds: number, state: ExternalGravityState): void {
    if (dtSeconds === 0) return;
    if (!Number.isFinite(dtSeconds)) {
      throw new Error("Gravity step duration must be finite");
    }

    const bodyCount = state.bodyStates.length;
    if (bodyCount === 0) return;
    this.readCanonicalState(state, bodyCount);

    const stepCount = getGravitySubstepCount(dtSeconds, this.maxStepSeconds);
    const substepSeconds = dtSeconds / stepCount;
    for (let i = 0; i < stepCount; i++) {
      this.computeGravityAccelerations(bodyCount);
      this.kickBodyVelocities(bodyCount, substepSeconds * 0.5);
      this.driftBodyPositions(bodyCount, substepSeconds);
      this.computeGravityAccelerations(bodyCount);
      this.kickBodyVelocities(bodyCount, substepSeconds * 0.5);
    }

    this.writeCanonicalState(state, bodyCount);
  }

  private readCanonicalState(
    state: ExternalGravityState,
    bodyCount: number,
  ): void {
    ensureWorkspaceCapacity(this.workspace, bodyCount);
    const masses = this.workspace.masses;
    const positions = this.workspace.positions;
    const velocities = this.workspace.velocities;
    for (let i = 0; i < bodyCount; i++) {
      const offset = i * 3;
      const position = state.positions[i];
      const body = state.bodyStates[i];
      masses[i] = body.mass;
      positions[offset] = position.x;
      positions[offset + 1] = position.y;
      positions[offset + 2] = position.z;
      velocities[offset] = body.velocity.x;
      velocities[offset + 1] = body.velocity.y;
      velocities[offset + 2] = body.velocity.z;
    }
  }

  private writeCanonicalState(
    state: ExternalGravityState,
    bodyCount: number,
  ): void {
    const positions = this.workspace.positions;
    const velocities = this.workspace.velocities;
    for (let i = 0; i < bodyCount; i++) {
      const offset = i * 3;
      const position = state.positions[i];
      const velocity = state.bodyStates[i].velocity;
      position.x = positions[offset];
      position.y = positions[offset + 1];
      position.z = positions[offset + 2];
      velocity.x = velocities[offset];
      velocity.y = velocities[offset + 1];
      velocity.z = velocities[offset + 2];
    }
  }

  private computeGravityAccelerations(bodyCount: number): void {
    const workspace = this.workspace;
    const accelerations = workspace.accelerations;
    const masses = workspace.masses;
    const positions = workspace.positions;
    accelerations.fill(0, 0, bodyCount * 3);
    const softeningLengthSq = this.softeningLength * this.softeningLength;

    for (let i = 0; i < bodyCount; i++) {
      const offsetI = i * 3;
      for (let j = i + 1; j < bodyCount; j++) {
        const offsetJ = j * 3;
        const dx = positions[offsetJ] - positions[offsetI];
        const dy = positions[offsetJ + 1] - positions[offsetI + 1];
        const dz = positions[offsetJ + 2] - positions[offsetI + 2];
        const radiusSq = dx * dx + dy * dy + dz * dz + softeningLengthSq;
        if (radiusSq === 0) continue;

        const inverseRadius = 1 / Math.sqrt(radiusSq);
        const inverseRadiusCubed =
          inverseRadius * inverseRadius * inverseRadius;
        const scaleI =
          this.gravitationalConstant * masses[j] * inverseRadiusCubed;
        const scaleJ =
          this.gravitationalConstant * masses[i] * inverseRadiusCubed;

        accelerations[offsetI] += dx * scaleI;
        accelerations[offsetI + 1] += dy * scaleI;
        accelerations[offsetI + 2] += dz * scaleI;
        accelerations[offsetJ] -= dx * scaleJ;
        accelerations[offsetJ + 1] -= dy * scaleJ;
        accelerations[offsetJ + 2] -= dz * scaleJ;
      }
    }
  }

  private kickBodyVelocities(bodyCount: number, dtSeconds: number): void {
    const accelerations = this.workspace.accelerations;
    const velocities = this.workspace.velocities;
    const componentCount = bodyCount * 3;
    for (let i = 0; i < componentCount; i++) {
      velocities[i] += accelerations[i] * dtSeconds;
    }
  }

  private driftBodyPositions(bodyCount: number, dtSeconds: number): void {
    const positions = this.workspace.positions;
    const velocities = this.workspace.velocities;
    const componentCount = bodyCount * 3;
    for (let i = 0; i < componentCount; i++) {
      positions[i] += velocities[i] * dtSeconds;
    }
  }
}

export function createPlugin(
  runtimeOptions: ExternalRuntimeOptions = {},
): ExternalPlugin {
  const maxStepSeconds = parseMaxGravityStepSeconds(runtimeOptions);
  return {
    id: "newtonianGravity",
    gravity: {
      createGravityEngine: () =>
        new NewtonianGravityEngine(
          NEWTON_G,
          SOFTENING_LENGTH_METERS,
          maxStepSeconds,
        ),
    },
  };
}

export function getGravitySubstepCount(
  dtSeconds: number,
  maxStepSeconds: number,
): number {
  requirePositiveFiniteMaxStep(maxStepSeconds);
  if (!Number.isFinite(dtSeconds)) {
    throw new Error("Gravity step duration must be finite");
  }
  return Math.max(1, Math.ceil(Math.abs(dtSeconds) / maxStepSeconds));
}

function ensureWorkspaceCapacity(
  workspace: NewtonianGravityWorkspace,
  bodyCount: number,
): void {
  if (workspace.masses.length >= bodyCount) return;
  let capacity = Math.max(1, workspace.masses.length);
  while (capacity < bodyCount) capacity *= 2;
  workspace.accelerations = new Float64Array(capacity * 3);
  workspace.masses = new Float64Array(capacity);
  workspace.positions = new Float64Array(capacity * 3);
  workspace.velocities = new Float64Array(capacity * 3);
}

function parseMaxGravityStepSeconds(
  runtimeOptions: ExternalRuntimeOptions,
): number {
  const raw = runtimeOptions[maxGravityStepSecondsRuntimeOption];
  if (raw === undefined) return DEFAULT_MAX_GRAVITY_STEP_SECONDS;
  const value = Number(raw);
  requirePositiveFiniteMaxStep(value);
  return value;
}

function requirePositiveFiniteMaxStep(value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(
      `${maxGravityStepSecondsRuntimeOption} must be a positive finite number`,
    );
  }
}
