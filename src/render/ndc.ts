import type { NdcPoint, ScreenPoint } from "./renderPorts.js";

export function ndcZero(): NdcPoint {
  return { x: 0, y: 0, depth: 0 };
}

/**
 * Map NDC coordinates into pixel space for a given screen size.
 */
export function ndcToScreenInto(
  into: ScreenPoint,
  ndc: NdcPoint,
  screenWidth: number,
  screenHeight: number,
): void {
  into.x = (ndc.x + 1) * 0.5 * screenWidth;
  into.y = (1 - ndc.y) * 0.5 * screenHeight;
  into.depth = ndc.depth;
}
