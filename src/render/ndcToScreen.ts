import type { NdcPoint } from "../scene/scenePorts.js";
import type { ScreenPoint } from "./renderPorts.js";

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
