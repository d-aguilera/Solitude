import type {
  PlanetSceneObject,
  ShipSceneObject,
  StarSceneObject,
} from "../app/scenePorts";
import type { Vec3 } from "../domain/vec3";
import type { RenderFrameCache } from "./renderFrameCache";
import { getCachedWorldPoints } from "./renderFrameCache";
import type { Renderable } from "./renderPorts";

/**
 * Convert a SceneObject into a Renderable with world-space points.
 *
 * For transformable objects, this uses the per-frame render cache.
 * The returned worldPoints array and its Vec3 elements are stable only
 * for the duration of the current render frame, not across frames.
 */
export function toRenderable(
  obj: ShipSceneObject | PlanetSceneObject | StarSceneObject,
  renderCache: RenderFrameCache,
): Renderable {
  const { applyTransform, color: baseColor, lineWidth, mesh } = obj;
  let worldPoints: Vec3[];

  if (applyTransform) {
    worldPoints = getCachedWorldPoints(renderCache, obj);
  } else {
    // Polyline or other world-space-only geometry: no transform, no copies.
    worldPoints = mesh.points;
  }

  return {
    mesh,
    worldPoints,
    lineWidth,
    baseColor,
  };
}
