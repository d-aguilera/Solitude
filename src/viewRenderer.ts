import { clear, draw } from "./renderScene.js";
import type { Scene, Profiler } from "./types.js";
import type { View } from "./viewTypes.js";

export function renderView(
  context: CanvasRenderingContext2D,
  scene: Scene,
  view: View,
  profiler: Profiler
): void {
  clear(context);
  draw(context, {
    objects: scene.objects,
    view,
    lightDir: scene.sunDirection,
    profiler,
  });

  if (view.debugDraw) {
    view.debugDraw(context);
  }
}
