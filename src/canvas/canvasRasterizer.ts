import type { RGB } from "../domain/domainPorts.js";
import type { FaceEntry } from "../render/renderPorts.js";
import type { ScreenPoint } from "../render/renderPorts.js";

/**
 * Depth-sort and rasterize shaded triangle faces.
 */
export function renderShadedFaces(
  context: CanvasRenderingContext2D,
  faceList: FaceEntry[],
): void {
  faceList.sort((a, b) => b.depth - a.depth);

  for (const face of faceList) {
    const { p0, p1, p2, baseColor } = face;
    const k = 0.2 + 0.8 * face.intensity;
    const { r: baseR, g: baseG, b: baseB } = baseColor;
    const r = Math.round(baseR * k);
    const g = Math.round(baseG * k);
    const b = Math.round(baseB * k);
    const fillStyle = rgbToCss({ r, g, b });

    fillTriangle(context, p0, p1, p2, fillStyle);
  }
}

/**
 * Render a polyline defined by screen-space points.
 */
export function renderPolyline(
  context: CanvasRenderingContext2D,
  points: ScreenPoint[],
  color: RGB,
  lineWidth: number,
): void {
  const strokeStyle = rgbToCss(color);
  strokePolyline(context, points, strokeStyle, lineWidth);
}

function strokePolyline(
  context: CanvasRenderingContext2D,
  points: ScreenPoint[],
  strokeStyle: string,
  lineWidth: number,
) {
  if (points.length < 2) return;
  context.strokeStyle = strokeStyle;
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
  fillStyle: string,
): void {
  context.fillStyle = fillStyle;
  context.beginPath();
  context.moveTo(p0.x, p0.y);
  context.lineTo(p1.x, p1.y);
  context.lineTo(p2.x, p2.y);
  context.closePath();
  context.fill();
}

function rgbToCss({ r, g, b }: { r: number; g: number; b: number }): string {
  return `rgb(${r}, ${g}, ${b})`;
}
