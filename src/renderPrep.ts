import { transformPointsToWorld } from "./math.js";
import type { Mesh, Renderable, SceneObject, Vec3 } from "./types.js";

/**
 * Convert a SceneObject into a Renderable with world-space points.
 */
export function toRenderable(obj: SceneObject): Renderable {
  const mesh: Mesh = obj.mesh;
  const baseColor = obj.color ?? mesh.color;
  const lineWidth = obj.lineWidth ?? mesh.lineWidth;

  const worldPoints: Vec3[] = obj.applyTransform
    ? transformPointsToWorld(
        mesh.points,
        obj.orientation,
        obj.scale,
        obj.position
      )
    : mesh.points; // Mesh points are already in world coordinates (e.g., trajectories)

  const colorCss =
    typeof baseColor === "string" ? baseColor : rgbToCss(baseColor);

  return {
    mesh,
    worldPoints,
    color: colorCss,
    lineWidth,
  };
}

function rgbToCss({ r, g, b }: { r: number; g: number; b: number }): string {
  return `rgb(${r}, ${g}, ${b})`;
}
