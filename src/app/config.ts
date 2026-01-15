import { DrawMode } from "../render/projection/viewTypes.js";

// Vertical field of view in degrees.
const VERTICAL_FOV = 30;

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
export function getFocalLengths(
  canvasWidth: number,
  canvasHeight: number
): { fX: number; fY: number } {
  const vFovRad = (VERTICAL_FOV * Math.PI) / 180;

  // Vertical focal length from chosen vertical FOV:
  const fY = 1 / Math.tan(vFovRad / 2);

  // Enforce circle condition: fX * W == fY * H
  const fX = fY * (canvasHeight / canvasWidth);

  return { fX, fY };
}

// Default draw mode for rendering (faces or lines).
export const DEFAULT_DRAW_MODE: DrawMode = "faces";
