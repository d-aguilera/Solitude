import type { HudRenderData } from "../app/appPorts.js";
import type { HudRenderer } from "../render/renderPorts.js";
import type { RenderSurface2D } from "../app/appPorts.js";
import { CanvasSurface } from "./CanvasSurface.js";

const hudWidth = 420;
const hudHeight = 70;
const margin = 10;

/**
 * Canvas2D HUD renderer.
 */
export class CanvasHudRenderer implements HudRenderer {
  render(surface: RenderSurface2D, hud: HudRenderData): void {
    const canvasSurface = surface as CanvasSurface;
    const ctx = canvasSurface.getContext();

    // HUD's top-left corner
    const x = ctx.canvas.width - hudWidth - margin;
    const y = margin;

    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(x, y, hudWidth, hudHeight);
    ctx.fillStyle = "white";
    ctx.font = "16px monospace";

    // Speed in km/h
    const speedKmh = hud.speedMps * 3.6;
    ctx.fillText(`Spd: ${speedKmh.toFixed(0)} km/h`, x + 10, y + 20);

    // FPS
    ctx.fillText(`FPS: ${hud.fps.toFixed(0)}`, x + 320, y + 20);

    // Pilot camera local offset (right, forward, up)
    const { x: ox, y: oy, z: oz } = hud.pilotCameraLocalOffset;
    ctx.fillText(
      `Cam: x=${ox.toFixed(2)} y=${oy.toFixed(2)} z=${oz.toFixed(2)}`,
      x + 10,
      y + 40,
    );

    // Thrust
    const thrustDisplay = `${(hud.thrustPercent * 100).toFixed(0)}%`;
    ctx.fillText(`Thrust: ${thrustDisplay}`, x + 320, y + 40);

    if (hud.profilingEnabled) {
      ctx.fillText("PROFILING", x + 320, y + 60);
    }
  }
}
