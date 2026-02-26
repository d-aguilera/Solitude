import type { ScreenPoint } from "./scrn.js";

/**
 * Normalized device coordinate in the projection plane:
 *   - x, y in [-1, 1] after perspective divide
 *   - depth is camera-space Y (forward distance)
 */
export interface NdcPoint {
  x: number;
  y: number;
  depth: number;
}

function toScreenInto(
  into: ScreenPoint,
  ndc: NdcPoint,
  screenWidth: number,
  screenHeight: number,
): void {
  into.x = (ndc.x + 1) * 0.5 * screenWidth;
  into.y = (1 - ndc.y) * 0.5 * screenHeight;
  into.depth = ndc.depth;
}

function zero(): NdcPoint {
  return { x: 0, y: 0, depth: 0 };
}

export const ndc = {
  /**
   * Map NDC coordinates into pixel space for a given screen size.
   */
  toScreenInto,
  zero,
};
