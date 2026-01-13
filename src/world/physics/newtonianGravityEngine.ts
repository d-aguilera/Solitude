import type { GravityEngine } from "./gravityPort.js";
import type { DomainWorld, GravityState } from "../domain.js";
import { applyGravity, buildInitialGravityState } from "./gravity.js";

/**
 * Concrete GravityEngine using the existing Newtonian N-body implementation.
 */
export class NewtonianGravityEngine implements GravityEngine {
  buildInitialState(world: DomainWorld, mainPlaneId: string): GravityState {
    return buildInitialGravityState(world, mainPlaneId);
  }

  step(dtSeconds: number, world: DomainWorld, state: GravityState): void {
    applyGravity(dtSeconds, world, state);
  }
}
