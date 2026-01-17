import type { Vec3 } from "../domain/domainPorts.js";
import { vec3 } from "../domain/vec3.js";
import type { NdcPoint, ScreenPoint } from "../render/renderInternals.js";

// camera-space forward threshold
export const NEAR = 0.01;

// Vertical field of view in degrees.
const VERTICAL_FOV = 30;

/**
 * Core projection from camera space -> NDC (no canvas size baked in).
 */
export function projectCameraPointToNdc(
  cameraPoint: Vec3,
  canvasWidth: number,
  canvasHeight: number,
): NdcPoint {
  const { fX, fY } = getFocalLengths(canvasWidth, canvasHeight);
  const depth = cameraPoint.y;

  const scaled = vec3.scale(
    { x: cameraPoint.x * fX, y: cameraPoint.z * fY, z: 0 },
    1 / depth,
  );

  return {
    x: scaled.x,
    y: scaled.y,
    depth,
  };
}

/**
 * Map NDC coordinates into pixel space for a given canvas.
 */
export function ndcToScreen(
  ndc: NdcPoint,
  canvasWidth: number,
  canvasHeight: number,
): ScreenPoint {
  return {
    x: (ndc.x + 1) * 0.5 * canvasWidth,
    y: (1 - ndc.y) * 0.5 * canvasHeight,
    depth: ndc.depth,
  };
}

/**
 * Convenience: project a camera-space point that is known to be in front of NEAR,
 * returning pixel coordinates for a specific canvas.
 */
export function projectCameraPoint(
  cameraPoint: Vec3,
  canvasWidth: number,
  canvasHeight: number,
): ScreenPoint {
  const ndc = projectCameraPointToNdc(cameraPoint, canvasWidth, canvasHeight);
  return ndcToScreen(ndc, canvasWidth, canvasHeight);
}

/**
 * Compute focal lengths (fX, fY) for our camera.
 *
 * Design goals:
 *   - We define a vertical field of view (VERTICAL_FOV) in radians.
 *   - We then choose fX so that a *sphere centered on the view axis*
 *     appears circular in pixel space, even when canvasWidth != canvasHeight.
 *
 * This “circle condition” is:
 *
 *   fX * canvasWidth == fY * canvasHeight
 *
 * Intuition:
 *   - In NDC, x and y are scaled by fX and fY, then mapped to pixels by
 *     multiplying by canvasWidth / 2 and canvasHeight / 2 respectively.
 *   - For a unit sphere straight ahead, equal pixel radii horizontally
 *     and vertically requires the combined scale in x and y to match.
 *
 * This is different from the conventional “fix VFOV, derive HFOV from aspect”
 * camera; here we bias the intrinsics so that round things look round
 * on screen.
 */
function getFocalLengths(
  canvasWidth: number,
  canvasHeight: number,
): { fX: number; fY: number } {
  const vFovRad = (VERTICAL_FOV * Math.PI) / 180;

  // Vertical focal length from chosen vertical FOV:
  const fY = 1 / Math.tan(vFovRad / 2);

  // Enforce circle condition: fX * W == fY * H
  const fX = fY * (canvasHeight / canvasWidth);

  return { fX, fY };
}
