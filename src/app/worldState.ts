import type { DomainWorld, PlaneBody } from "../domain/domainPorts.js";

/**
 * Adapter-level world state used by the app and renderer.
 *
 * This wraps the pure DomainWorld; outer layers are free to add
 * additional derived fields without changing the domain model.
 */
export interface WorldState extends DomainWorld {
  planes: Plane[];
}

/**
 * Plane adapter type extends the domain PlaneBody with derived speed
 * for HUD/debug overlays.
 */
export interface Plane extends PlaneBody {
  speed: number;
}
