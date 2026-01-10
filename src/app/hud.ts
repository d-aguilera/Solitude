import { fps } from "./fps.js";
import type { Plane } from "../world/types.js";
import { vec } from "../world/vec3.js";

export function renderHUD(
  context: CanvasRenderingContext2D,
  plane: Plane,
  profilingEnabled: boolean
): void {
  const hudWidth = 420;
  const hudHeight = 80;
  const margin = 10;

  const canvasWidth = context.canvas.width;

  // Top-right corner
  const x = canvasWidth - hudWidth - margin;
  const y = margin;

  context.fillStyle = "rgba(0, 0, 0, 0.6)";
  context.fillRect(x, y, hudWidth, hudHeight);
  context.fillStyle = "white";
  context.font = "16px monospace";

  // Distance from origin in kilometers
  const distFromOriginM = vec.length(plane.position);
  const distFromOriginKm = distFromOriginM / 1000;
  context.fillText(`|pos|: ${distFromOriginKm.toFixed(1)} km`, x + 10, y + 20);

  // Speed in km/h
  const speedMps = vec.length(plane.velocity);
  const speedKmh = speedMps * 3.6;
  context.fillText(`Spd: ${speedKmh.toFixed(1)} km/h`, x + 10, y + 40);

  context.fillText(`FPS: ${fps.toFixed(1)}`, x + 250, y + 20);

  if (profilingEnabled) context.fillText("PROFILING", x + 250, y + 60);
}
