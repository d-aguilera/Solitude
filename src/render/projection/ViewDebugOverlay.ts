import type { Scene } from "../scene/scenePorts.js";

export type DrawMode = "faces" | "lines";

/**
 * Optional debug overlay hook for a view. Not part of scene geometry.
 */
export interface ViewDebugOverlay {
  draw: (ctx: CanvasRenderingContext2D, scene: Scene) => void;
}
