import { clear, draw } from "../scene/renderScene.js";
import type { Scene, Profiler } from "../../world/types.js";
import type { View } from "./viewTypes.js";

let viewFrameCounter = 0;

export function renderView(
  context: CanvasRenderingContext2D,
  scene: Scene,
  view: View,
  profiler: Profiler
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

  if (view.debugDraw) {
    view.debugDraw(context, scene, view.referencePlane);
  }
}
