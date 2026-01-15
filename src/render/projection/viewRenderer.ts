import { clear, draw } from "../scene/renderScene.js";
import type { Scene } from "../../world/types.js";
import type { View, ViewDebugOverlay } from "./viewTypes.js";
import type { ViewRenderer } from "./viewRendererPort.js";
import type { ViewConfig } from "../../app/viewConfig.js";
import type { Profiler } from "../../world/domain.js";

let viewFrameCounter = 0;

/**
 * Render a scene from a given view.
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

/**
 * Concrete ViewRenderer implementation that delegates to renderView.
 */
export class DefaultViewRenderer implements ViewRenderer {
  renderView(params: {
    context: CanvasRenderingContext2D;
    scene: Scene;
    viewConfig: ViewConfig;
    profiler: Profiler;
  }): void {
    const { context, scene, viewConfig, profiler } = params;
    const { view, debugOverlay } = viewConfig;

    renderView(context, scene, view, profiler, debugOverlay);
  }
}
