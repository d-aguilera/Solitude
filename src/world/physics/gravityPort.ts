import type { GravityState, WorldState } from "../types.js";

/**
 * Domain-level abstraction for gravitational integration.
 *
 * The game loop depends on this port, not on a specific implementation.
 */
export interface GravityEngine {
  buildInitialState(world: WorldState, mainPlaneId: string): GravityState;
  step(dtSeconds: number, world: WorldState, state: GravityState): void;
}
