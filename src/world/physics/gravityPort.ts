import type { DomainWorld, GravityState } from "../domain.js";

/**
 * Domain-level abstraction for gravitational integration.
 *
 * The game loop depends on this port, not on a specific implementation.
 */
export interface GravityEngine {
  buildInitialState(world: DomainWorld, mainPlaneId: string): GravityState;
  step(dtSeconds: number, world: DomainWorld, state: GravityState): void;
}
