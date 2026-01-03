import { clear, draw } from "./draw.js";
import type { Scene, View, Profiler } from "./types.js";

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
    view.debugDraw(context, view.projection);
  }
}
