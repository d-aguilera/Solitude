import type { ScreenPoint } from "../projection/projection.js";
import type { FaceEntry } from "../scene/shadedFaces.js";

/**
 * Canvas2D-specific rasterization utilities.
 */

/**
 * Depth-sort and rasterize shaded triangle faces.
 */
export function renderShadedFacesToCanvas(
  context: CanvasRenderingContext2D,
  faceList: FaceEntry[]
): void {
  faceList.sort((a, b) => b.depth - a.depth);

  for (const face of faceList) {
    const { p0, p1, p2, baseR, baseG, baseB } = face;
    const k = 0.2 + 0.8 * face.intensity;
    const r = Math.round(baseR * k);
    const g = Math.round(baseG * k);
    const b = Math.round(baseB * k);
    const fillStyle = `rgb(${r}, ${g}, ${b})`;

    fillTriangle(context, p0, p1, p2, fillStyle);
  }
}

/**
 * Stroke an polyline defined by screen-space points.
 */
export function strokePolylineOnCanvas(
  context: CanvasRenderingContext2D,
  points: ScreenPoint[],
  color: string,
  lineWidth: number
): void {
  if (points.length === 0) return;

  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    context.lineTo(points[i].x, points[i].y);
  }
  context.stroke();
}

function fillTriangle(
  context: CanvasRenderingContext2D,
  p0: ScreenPoint,
  p1: ScreenPoint,
  p2: ScreenPoint,
  fillStyle: string
): void {
  context.fillStyle = fillStyle;
  context.beginPath();
  context.moveTo(p0.x, p0.y);
  context.lineTo(p1.x, p1.y);
  context.lineTo(p2.x, p2.y);
  context.closePath();
  context.fill();
}
