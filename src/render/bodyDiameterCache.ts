import type {
  BodySceneObject,
  LightEmitterSceneObject,
} from "../app/scenePorts";
import { vec3 } from "../domain/vec3";

const objectDiameterWorldScratch = new WeakMap<
  BodySceneObject | LightEmitterSceneObject,
  number
>();

/**
 * Returns the world-space diameter for a body mesh, cached per object.
 */
export function getBodyDiameterWorld(
  obj: BodySceneObject | LightEmitterSceneObject,
): number {
  const cached = objectDiameterWorldScratch.get(obj);
  if (cached !== undefined) return cached;

  const points = obj.mesh.points;
  let maxRadiusSq = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const r2 = vec3.lengthSq(p);
    if (r2 > maxRadiusSq) maxRadiusSq = r2;
  }

  const diameter = 2 * Math.sqrt(maxRadiusSq);
  objectDiameterWorldScratch.set(obj, diameter);
  return diameter;
}
