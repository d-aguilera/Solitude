import { Mesh, Vec3 } from "../world/domain.js";

/**
 * Append a point to a polyline mesh, adding a segment from the
 * previous point to this one.
 *
 * Mesh points are assumed to be in world space (no transform applied).
 */
export function appendPointToPolylineMesh(mesh: Mesh, point: Vec3): void {
  const newIndex = mesh.points.length;
  if (newIndex === 0) {
    mesh.points.push({ ...point });
    return;
  }
  mesh.points.push({ ...point });
  mesh.faces.push([newIndex - 1, newIndex]);
}
