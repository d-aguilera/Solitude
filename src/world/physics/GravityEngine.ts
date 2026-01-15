import type { DomainWorld, GravityState } from "../domain.js";

/**
 * Domain-level abstraction for gravitational integration.
 *
 * The domain layer and any outer layers that need pure physics depend on this
 * port, not on a specific implementation.
 */
export interface GravityEngine {
  /**
   * Build an immutable GravityState snapshot from the given DomainWorld.
   *
   * The DomainWorld passed here should be a pure domain container, not any
   * adapter-extended world state.
   */
  buildInitialState(world: DomainWorld, mainPlaneId: string): GravityState;

  /**
   * Advance gravity simulation by dtSeconds, returning a new GravityState.
   *
   * Implementations must be side‑effect free with respect to the passed
   * DomainWorld and GravityState. Any world mutation is the responsibility
   * of an outer adapter.
   */
  step(
    dtSeconds: number,
    world: DomainWorld,
    state: GravityState
  ): GravityState;
}
