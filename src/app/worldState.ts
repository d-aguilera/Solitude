import type { DomainWorld, PlaneBody } from "../domain/domainPorts.js";

/**
 * Adapter-level world state used by the app and renderer.
 *
 * This wraps the DomainWorld so that outer layers do not depend on
 * the raw domain container directly.
 */
export interface WorldState extends DomainWorld {
  planes: Plane[];
}

/**
 * Plane adapter type extends PlaneBody with derived speed for HUD/debug.
 */
export interface Plane extends PlaneBody {
  speed: number;
}
