import type { Vec3 } from "../../world/types.js";

/**
 * In-place look adjustment in camera space for pilot view.
 *
 * Applies yaw (azimuth) around the camera-space Z axis and pitch (elevation)
 * around the camera-space X axis in that order.
 */
export function applyPilotLook(
  cameraPoint: Vec3,
  azimuth: number,
  elevation: number
): void {
  if (azimuth === 0 && elevation === 0) {
    return;
  }

  if (azimuth !== 0) {
    const r = rotate2D(cameraPoint.x, cameraPoint.y, -azimuth);
    cameraPoint.x = r.a;
    cameraPoint.y = r.b;
  }

  if (elevation !== 0) {
    const r = rotate2D(cameraPoint.y, cameraPoint.z, -elevation);
    cameraPoint.y = r.a;
    cameraPoint.z = r.b;
  }
}

function rotate2D(
  a: number,
  b: number,
  angle: number
): { a: number; b: number } {
  const c = Math.cos(angle);
  const s = Math.sin(angle);

  return {
    a: a * c - b * s,
    b: a * s + b * c,
  };
}
