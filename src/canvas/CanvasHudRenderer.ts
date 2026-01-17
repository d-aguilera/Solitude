import type { HudRenderData } from "../render/renderPorts.js";

/**
 * Canvas2D HUD renderer.
 */
export function renderCanvasHud(
  context: CanvasRenderingContext2D,
  hud: HudRenderData,
): void {
  const hudWidth = 420;
  const hudHeight = 70;
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
  const speedKmh = hud.speedMps * 3.6;
  context.fillText(`Spd: ${speedKmh.toFixed(0)} km/h`, x + 10, y + 20);

  // FPS
  context.fillText(`FPS: ${hud.fps.toFixed(0)}`, x + 320, y + 20);

  // Pilot camera local offset (right, forward, up)
  const { x: ox, y: oy, z: oz } = hud.pilotCameraLocalOffset;
  context.fillText(
    `Cam: x=${ox.toFixed(2)} y=${oy.toFixed(2)} z=${oz.toFixed(2)}`,
    x + 10,
    y + 40,
  );

  // Thrust
  const thrustDisplay = `${(hud.thrustPercent * 100).toFixed(0)}%`;
  context.fillText(`Thrust: ${thrustDisplay}`, x + 320, y + 40);

  if (hud.profilingEnabled) {
    context.fillText("PROFILING", x + 320, y + 60);
  }
}
