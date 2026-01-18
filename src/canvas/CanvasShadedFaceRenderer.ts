import type {
  FaceEntry,
  RenderSurface2D,
  ShadedFaceRenderer,
} from "../render/renderPorts.js";
import { rgbToCss } from "./canvasRasterizer.js";
import type { CanvasSurface } from "./CanvasSurface.js";

/**
 * Canvas2D shaded-face renderer.
 */
export class CanvasShadedFaceRenderer implements ShadedFaceRenderer {
  render(surface: RenderSurface2D, faceList: FaceEntry[]): void {
    const canvasSurface = surface as CanvasSurface;
    const ctx = canvasSurface.getContext();

    faceList.sort((a, b) => b.depth - a.depth);

    for (const face of faceList) {
      const { p0, p1, p2, baseColor } = face;
      const k = 0.2 + 0.8 * face.intensity;
      const { r: baseR, g: baseG, b: baseB } = baseColor;
      const r = Math.round(baseR * k);
      const g = Math.round(baseG * k);
      const b = Math.round(baseB * k);

      ctx.fillStyle = rgbToCss({ r, g, b });
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.closePath();
      ctx.fill();
    }
  }
}
