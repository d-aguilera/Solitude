import type { NdcPoint, ScreenPoint } from "./renderPorts.js";

/**
 * Map NDC coordinates into pixel space for a given screen size.
 */
export function ndcToScreen(
  ndc: NdcPoint,
  screenWidth: number,
  screenHeight: number,
): ScreenPoint {
  return {
    x: (ndc.x + 1) * 0.5 * screenWidth,
    y: (1 - ndc.y) * 0.5 * screenHeight,
    depth: ndc.depth,
  };
}
