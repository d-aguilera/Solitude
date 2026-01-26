import { rgbToCss } from "../render/color.js";
import type {
  Rasterizer,
  RenderedBodyLabel,
  RenderedFace,
  RenderedHud,
  RenderedPolyline,
  RenderedSegment,
  RenderSurface2D,
} from "../render/renderPorts.js";
import type { CanvasSurface } from "./CanvasSurface.js";

const hudWidth = 420;
const hudHeight = 70;
const margin = 10;

/**
 * Canvas2D rasterizer.
 */
export class CanvasRasterizer implements Rasterizer {
  clear(surface: RenderSurface2D, color: string): void {
    const canvasSurface = surface as CanvasSurface;
    const ctx = canvasSurface.getContext();

    const { width, height } = ctx.canvas;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
  }

  drawBodyLabels(surface: RenderSurface2D, labels: RenderedBodyLabel[]): void {
    const canvasSurface = surface as CanvasSurface;
    const ctx = canvasSurface.getContext();

    const lineHeight = 16;
    const offsetX = 16;
    const offsetY = -24;
    const paddingX = 6;
    const paddingY = 4;

    ctx.save();
    ctx.font = "14px monospace";
    ctx.textBaseline = "middle";

    for (const label of labels) {
      const anchorX = label.anchor.x;
      const anchorY = label.anchor.y;

      const lines = [
        label.name,
        `d=${label.distanceKm.toFixed(0)} km`,
        `v=${label.speedKmh.toFixed(2)} km/h`,
      ];

      let maxTextWidth = 0;
      for (const line of lines) {
        const w = ctx.measureText(line).width;
        if (w > maxTextWidth) maxTextWidth = w;
      }

      const boxWidth = maxTextWidth + paddingX * 2;
      const boxHeight = lines.length * lineHeight + paddingY * 2;

      const boxX = anchorX + offsetX;
      const boxY = anchorY + offsetY;

      ctx.strokeStyle = "white";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(anchorX, anchorY);
      ctx.lineTo(boxX, boxY + boxHeight / 2);
      ctx.stroke();

      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

      ctx.strokeStyle = "white";
      ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

      ctx.fillStyle = "white";
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const cy = boxY + paddingY + lineHeight * (i + 0.5);
        ctx.fillText(line, boxX + paddingX, cy);
      }
    }

    ctx.restore();
  }

  drawFaces(surface: RenderSurface2D, faces: RenderedFace[]): void {
    const canvasSurface = surface as CanvasSurface;
    const ctx = canvasSurface.getContext();

    for (const face of faces) {
      const { p0, p1, p2, color } = face;
      ctx.fillStyle = rgbToCss(color);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawHud(surface: RenderSurface2D, hud: RenderedHud): void {
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

  drawPolylines(surface: RenderSurface2D, polylines: RenderedPolyline[]): void {
    const canvasSurface = surface as CanvasSurface;
    const ctx = canvasSurface.getContext();

    for (const polyline of polylines) {
      const { points, cssColor, lineWidth } = polyline;
      if (points.length < 2) return;
      ctx.strokeStyle = cssColor;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      let p = points[0];
      ctx.moveTo(p.x, p.y);
      for (let i = 1; i < points.length; i++) {
        p = points[i];
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
  }

  drawSegments(surface: RenderSurface2D, segments: RenderedSegment[]): void {
    const canvasSurface = surface as CanvasSurface;
    const ctx = canvasSurface.getContext();

    ctx.save();
    ctx.lineWidth = 4;

    for (const seg of segments) {
      ctx.strokeStyle = seg.cssColor;
      ctx.beginPath();
      ctx.moveTo(seg.start.x, seg.start.y);
      ctx.lineTo(seg.end.x, seg.end.y);
      ctx.stroke();
    }

    ctx.restore();
  }
}
