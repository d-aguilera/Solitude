import { clear, draw } from "../scene/renderScene.js";
import type { Scene, Profiler } from "../../world/types.js";
import type { View, ViewDebugOverlay } from "./viewTypes.js";

let viewFrameCounter = 0;

/**
 * Render a scene from a given view.
 *
 * Responsibilities:
 *  - Clear the canvas
 *  - Rasterize all scene objects according to the view's camera/projection
 *  - Optionally render a debug overlay (kept separate from core scene draw)
 *
 * This function is intentionally unaware of *which* entities are being
 * debugged; that policy is owned by the caller and encoded inside the
 * ViewDebugOverlay implementation.
 */
export function renderView(
  context: CanvasRenderingContext2D,
  scene: Scene,
  view: View,
  profiler: Profiler,
  debugOverlay?: ViewDebugOverlay
): void {
  const frameId = ++viewFrameCounter;

  clear(context);
  draw(context, {
    objects: scene.objects,
    view,
    lights: scene.lights,
    profiler,
    frameId,
  });

  if (debugOverlay) {
    debugOverlay.draw(context, scene);
  }
}
