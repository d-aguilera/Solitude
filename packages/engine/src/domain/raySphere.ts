import type { Vec3 } from "./vec3";
import { vec3 } from "./vec3";

const centerDeltaScratch = vec3.zero();

/** Returns the nearest non-negative hit distance along a normalized ray. */
export function raySphereFirstHitDistance(
  rayOrigin: Vec3,
  rayDirection: Vec3,
  sphereCenter: Vec3,
  sphereRadius: number,
): number | null {
  vec3.subInto(centerDeltaScratch, sphereCenter, rayOrigin);
  const projectedDistance = vec3.dot(centerDeltaScratch, rayDirection);
  const perpendicularDistanceSq = Math.max(
    0,
    vec3.lengthSq(centerDeltaScratch) - projectedDistance * projectedDistance,
  );
  const radiusSq = sphereRadius * sphereRadius;
  if (perpendicularDistanceSq > radiusSq) return null;

  const halfChord = Math.sqrt(radiusSq - perpendicularDistanceSq);
  const nearDistance = projectedDistance - halfChord;
  if (nearDistance >= 0) return nearDistance;
  const farDistance = projectedDistance + halfChord;
  return farDistance >= 0 ? farDistance : null;
}
