import type { Vec3 } from "../../domain/domainPorts";

export interface DebugPlane {
  id: string;
  position: Vec3;
  velocity: Vec3;
}
