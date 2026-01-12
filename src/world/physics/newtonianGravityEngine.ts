import type { GravityEngine } from "./gravityPort.js";
import type { GravityState, WorldState } from "../types.js";
import { applyGravity, buildInitialGravityState } from "./gravity.js";

/**
 * Concrete GravityEngine using the existing Newtonian N-body implementation.
 */
export class NewtonianGravityEngine implements GravityEngine {
  buildInitialState(world: WorldState, mainPlaneId: string): GravityState {
    return buildInitialGravityState(world, mainPlaneId);
  }

  step(dtSeconds: number, world: WorldState, state: GravityState): void {
    applyGravity(dtSeconds, world, state);
  }
}
