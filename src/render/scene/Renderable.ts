import type { Mesh, RGB, Vec3 } from "../../domain/domainPorts.js";

export interface Renderable {
  mesh: Mesh;
  worldPoints: Vec3[];
  lineWidth: number;
  baseColor: RGB;
}
