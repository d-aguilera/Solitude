import type { Vec3 } from "../domain/domainPorts.js";

export interface DebugPlane {
  id: string;
  position: Vec3;
  velocity: Vec3;
}
