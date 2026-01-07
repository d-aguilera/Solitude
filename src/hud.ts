import { fps } from "./fps.js";
import type { Plane } from "./types.js";
import { vec } from "./vec3.js";

export function renderHUD(
  context: CanvasRenderingContext2D,
  plane: Plane,
  profilingEnabled: boolean
): void {
  context.fillStyle = "rgba(0, 0, 0, 0.6)";
  context.fillRect(0, 0, 360, 80);
  context.fillStyle = "white";
  context.font = "16px monospace";

  const distFromOrigin = vec.length(plane.position);
  context.fillText(`|pos|: ${distFromOrigin.toFixed(1)} m`, 10, 20);

  const speedKnots = plane.speed * 1.94384;
  context.fillText(
    `Spd: ${plane.speed.toFixed(1)} m/s (${speedKnots.toFixed(0)} kt)`,
    10,
    40
  );

  context.fillText(`FPS: ${fps.toFixed(1)}`, 200, 20);

  if (profilingEnabled) context.fillText("PROFILING", 250, 60);
}
