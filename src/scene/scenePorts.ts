import type { Mesh, Vec3, RGB, LocalFrame } from "../domain/domainPorts";

/**
 * Canonical camera representation used throughout world/scene transforms.
 */
export interface Camera {
  position: Vec3;
  frame: LocalFrame;
}

/**
 * Normalized device coordinate in the projection plane:
 *   - x, y in [-1, 1] after perspective divide
 *   - depth is camera-space Y (forward distance)
 */
export interface NdcPoint {
  x: number;
  y: number;
  depth: number;
}

export interface Renderable {
  mesh: Mesh;
  worldPoints: Vec3[];
  lineWidth: number;
  baseColor: RGB;
}
