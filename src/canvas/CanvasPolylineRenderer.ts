import type { RGB } from "../domain/domainPorts.js";
import { rgbToCss } from "../render/color.js";
import type { PolylineRenderer, ScreenPoint } from "../render/renderPorts.js";
import type { RenderSurface2D } from "../render/renderPorts.js";
import type { CanvasSurface } from "./CanvasSurface.js";

/**
 * Canvas2D polyline renderer.
 */
export class CanvasPolylineRenderer implements PolylineRenderer {
  render(
    surface: RenderSurface2D,
    points: ScreenPoint[],
    color: RGB,
    lineWidth: number,
  ): void {
    if (points.length < 2) return;
    const canvasSurface = surface as CanvasSurface;
    const ctx = canvasSurface.getContext();
    ctx.strokeStyle = rgbToCss(color);
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
  }
}
