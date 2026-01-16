import { Scene } from "../scene/scenePorts";

export type DrawMode = "faces" | "lines";

/**
 * Optional debug overlay hook for a view. Not part of scene geometry.
 *
 * NOTE:
 *  This is intentionally *decoupled* from the core `View`. Callers are
 *  responsible for threading any additional data they need (e.g. reference
 *  plane, chosen debug planes) into their overlay implementation rather than
 *  encoding that policy into the renderer.
 */
export interface ViewDebugOverlay {
  draw: (ctx: CanvasRenderingContext2D, scene: Scene) => void;
}
