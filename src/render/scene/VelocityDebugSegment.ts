import type { Vec3 } from "../../domain/domainPorts.js";

/**
 * World-space line segment for velocity debug visualization.
 */
export interface VelocityDebugSegment {
  start: Vec3;
  end: Vec3;
  color: "forward" | "backward";
}
