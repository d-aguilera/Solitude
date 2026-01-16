import type { PlaneBody } from "../domain/domainPorts.js";

/**
 * Adapter-level plane view used by app and rendering.
 *
 * This is a thin DTO around the domain PlaneBody.
 */
export interface Plane extends PlaneBody {
  speed: number;
}
