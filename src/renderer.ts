import { clear, draw } from "./draw.js";
import { fps } from "./fps.js";
import { vec } from "./math.js";
import type { ScreenPoint } from "./projection.js";
import type { Plane, Profiler, Scene, Vec3, View } from "./types.js";

type ProjectionFn = (p: Vec3) => ScreenPoint | null;

export interface RenderViewParams {
  scene: Scene;
  projection: ProjectionFn;
  cameraPos: Vec3 | null;
  profiler: Profiler;
}

export function renderView(
  context: CanvasRenderingContext2D,
  scene: Scene,
  view: View,
  profiler: Profiler
): void {
  clear(context);

  draw(context, {
    objects: scene.objects,
    projection: view.projection,
    cameraPos: view.cameraPos,
    lightDir: scene.sunDirection,
    profiler,
  });
}

export function renderHUD(
  topContext: CanvasRenderingContext2D,
  plane: Plane,
  profilingEnabled: boolean
): void {
  topContext.fillStyle = "rgba(0, 0, 0, 0.6)";
  topContext.fillRect(0, 0, 360, 80);
  topContext.fillStyle = "white";
  topContext.font = "16px monospace";

  const distFromOrigin = vec.length(plane.position);
  topContext.fillText(`|pos|: ${distFromOrigin.toFixed(1)} m`, 10, 20);

  const speedKnots = plane.speed * 1.94384;
  topContext.fillText(
    `Spd: ${plane.speed.toFixed(1)} m/s (${speedKnots.toFixed(0)} kt)`,
    10,
    40
  );

  topContext.fillText(`FPS: ${fps.toFixed(1)}`, 200, 20);

  if (profilingEnabled) topContext.fillText("PROFILING", 250, 60);
}
