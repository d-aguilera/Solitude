import type {
  ViewDebugOverlayRenderer,
  ScreenPoint,
} from "../render/renderPorts.js";
import type { RenderSurface2D } from "../app/appPorts.js";
import type { CanvasSurface } from "./CanvasSurface.js";

/**
 * Canvas-backed implementation of ViewDebugOverlayRenderer.
 */
export class CanvasDebugOverlayRenderer implements ViewDebugOverlayRenderer {
  drawShipVelocityLine(
    surface: RenderSurface2D,
    segments: {
      start: ScreenPoint;
      end: ScreenPoint;
      color: "forward" | "backward";
    }[],
  ): void {
    const canvasSurface = surface as CanvasSurface;
    const ctx = canvasSurface.getContext();
    ctx.save();
    ctx.lineWidth = 4;

    for (const seg of segments) {
      ctx.strokeStyle = seg.color === "forward" ? "lime" : "red";
      ctx.beginPath();
      ctx.moveTo(seg.start.x, seg.start.y);
      ctx.lineTo(seg.end.x, seg.end.y);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawBodyLabel(
    surface: RenderSurface2D,
    label: {
      anchor: ScreenPoint;
      name: string;
      distanceKm: number;
      speedKmh: number;
    },
  ): void {
    const canvasSurface = surface as CanvasSurface;
    const ctx = canvasSurface.getContext();
    ctx.save();
    ctx.font = "14px monospace";
    ctx.textBaseline = "middle";

    const { width, height } = ctx.canvas;
    void width;
    void height;

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

    const paddingX = 6;
    const paddingY = 4;
    const boxWidth = maxTextWidth + paddingX * 2;
    const lineHeight = 16;
    const boxHeight = lines.length * lineHeight + paddingY * 2;

    const offsetX = 16;
    const offsetY = -24;
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

    ctx.restore();
  }
}
