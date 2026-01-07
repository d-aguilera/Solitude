import { Mat3 } from "./mat3.js";
import type { Mesh, Renderable, SceneObject, Vec3 } from "./types.js";

/**
 * Convert a SceneObject into a Renderable with world-space points.
 */
export function toRenderable(obj: SceneObject): Renderable {
  const mesh: Mesh = obj.mesh;
  const baseColor = obj.color ?? mesh.color;

  const worldPoints: Vec3[] = obj.applyTransform
    ? transformPointsToWorld(
        mesh.points,
        obj.orientation,
        obj.scale,
        obj.position
      )
    : mesh.points;

  const colorCss =
    typeof baseColor === "string" ? baseColor : rgbToCss(baseColor);

  return {
    mesh,
    worldPoints,
    color: colorCss,
    lineWidth: obj.lineWidth,
  };
}

function transformPointsToWorld(
  points: Vec3[],
  R: Mat3,
  s: number,
  position: Vec3
): Vec3[] {
  const out = new Array<Vec3>(points.length);
  const { x: tx, y: ty, z: tz } = position;

  for (let i = 0; i < points.length; i++) {
    const { x, y, z } = points[i];
    const lx = x * s;
    const ly = y * s;
    const lz = z * s;
    const R0 = R[0];
    const R1 = R[1];
    const R2 = R[2];

    out[i] = {
      x: R0[0] * lx + R0[1] * ly + R0[2] * lz + tx,
      y: R1[0] * lx + R1[1] * ly + R1[2] * lz + ty,
      z: R2[0] * lx + R2[1] * ly + R2[2] * lz + tz,
    };
  }

  return out;
}

function rgbToCss({ r, g, b }: { r: number; g: number; b: number }): string {
  return `rgb(${r}, ${g}, ${b})`;
}
