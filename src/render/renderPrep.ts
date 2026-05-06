import type {
  BodySceneObject,
  ControlledBodySceneObject,
  LightEmitterSceneObject,
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
  obj: ControlledBodySceneObject | BodySceneObject | LightEmitterSceneObject,
  renderCache: RenderFrameCache,
): Renderable {
  let worldPoints: Vec3[];

  if (obj.applyTransform) {
    worldPoints = getCachedWorldPoints(renderCache, obj);
  } else {
    // Polyline or other world-space-only geometry: no transform, no copies.
    worldPoints = obj.mesh.points;
  }

  return {
    mesh: obj.mesh,
    worldPoints,
    lineWidth: obj.lineWidth,
    baseColor: obj.color,
  };
}
