import { rgbToCss } from "../render/color.js";
import type { FaceRenderer, RenderedFace } from "../render/renderPorts.js";
import type { RenderSurface2D } from "../render/renderPorts.js";
import type { CanvasSurface } from "./CanvasSurface.js";

/**
 * Canvas2D face renderer.
 */
export class CanvasFaceRenderer implements FaceRenderer {
  render(surface: RenderSurface2D, faces: RenderedFace[]): void {
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
}
