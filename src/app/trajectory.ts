import type { Mesh, Vec3 } from "../domain/domainPorts.js";

/**
 * Append a point to a polyline mesh, adding a segment from the
 * previous point to this one.
 *
 * Mesh points are assumed to be in world space (no transform applied).
 */
export function appendPointToPolylineMesh(mesh: Mesh, point: Vec3): void {
  const newIndex = mesh.points.length;
  if (newIndex === 0) {
    mesh.points = [];
    mesh.points.push({ ...point });
    mesh.faces = [];
    return;
  }
  if (newIndex === 1) {
    mesh.points.push({ ...point });
    mesh.faces.push([0, 1]);
    return;
  }
  mesh.points.push({ ...point });
  mesh.faces[0].push(newIndex);
}
