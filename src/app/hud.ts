import { fps } from "./fps.js";
import type { Plane } from "../world/types.js";
import { vec } from "../world/vec3.js";

export function renderHUD(
  context: CanvasRenderingContext2D,
  plane: Plane,
  profilingEnabled: boolean
): void {
  context.fillStyle = "rgba(0, 0, 0, 0.6)";
  context.fillRect(0, 0, 420, 80);
  context.fillStyle = "white";
  context.font = "16px monospace";

  // Distance from origin in kilometers
  const distFromOriginM = vec.length(plane.position);
  const distFromOriginKm = distFromOriginM / 1000;
  context.fillText(`|pos|: ${distFromOriginKm.toFixed(1)} km`, 10, 20);

  // Speed in km/h
  const speedMps = vec.length(plane.velocity);
  const speedKmh = speedMps * 3.6;
  context.fillText(`Spd: ${speedKmh.toFixed(1)} km/h`, 10, 40);

  context.fillText(`FPS: ${fps.toFixed(1)}`, 250, 20);

  if (profilingEnabled) context.fillText("PROFILING", 250, 60);
}
