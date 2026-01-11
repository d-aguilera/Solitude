import { fps } from "./fps.js";
import type { Plane, Vec3 } from "../world/types.js";
import { vec } from "../world/vec3.js";

export function renderHUD(
  context: CanvasRenderingContext2D,
  plane: Plane,
  profilingEnabled: boolean,
  pilotCameraLocalOffset: Vec3
): void {
  const hudWidth = 420;
  const hudHeight = 50;
  const margin = 10;

  const canvasWidth = context.canvas.width;

  // HUD's top-left corner
  const x = canvasWidth - hudWidth - margin;
  const y = margin;

  context.fillStyle = "rgba(0, 0, 0, 0.6)";
  context.fillRect(x, y, hudWidth, hudHeight);
  context.fillStyle = "white";
  context.font = "16px monospace";

  // Speed in km/h
  const speedMps = vec.length(plane.velocity);
  const speedKmh = speedMps * 3.6;
  context.fillText(`Spd: ${speedKmh.toFixed(0)} km/h`, x + 10, y + 20);

  // FPS
  context.fillText(`FPS: ${fps.toFixed(0)}`, x + 320, y + 20);

  // Pilot camera local offset (right, forward, up)
  const { x: ox, y: oy, z: oz } = pilotCameraLocalOffset;
  context.fillText(
    `Cam: x=${ox.toFixed(2)} y=${oy.toFixed(2)} z=${oz.toFixed(2)}`,
    x + 10,
    y + 40
  );

  if (profilingEnabled) {
    context.fillText("PROFILING", x + 320, y + 40);
  }
}
