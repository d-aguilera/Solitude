import type { RGB } from "../domain/domainPorts.js";
import { rgbToCss } from "../render/color.js";
import type {
  Rasterizer,
  RenderedBodyLabel,
  RenderedFace,
  RenderedHud,
  RenderedPolyline,
  RenderedSegment,
  TextMetrics,
} from "../render/renderPorts.js";
import type { ScreenPoint } from "../render/scrn.js";

const hudWidth = 420;
const hudMargin = 10;
const hudPadding = 10;

// scratch
let label: RenderedBodyLabel;
let anchor: ScreenPoint;
let lines: string[];
let padding: { width: number; height: number };
let position: ScreenPoint;
let size: { width: number; height: number };
let edgePoint: ScreenPoint;
let face: RenderedFace;
let p0: ScreenPoint;
let p1: ScreenPoint;
let p2: ScreenPoint;
let color: RGB;
let p: ScreenPoint;

/**
 * Canvas2D rasterizer.
 */
export class CanvasRasterizer implements Rasterizer {
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  clear(color: string): void {
    const ctx = this.ctx;
    const { width, height } = ctx.canvas;

    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
  }

  drawBodyLabels(labels: RenderedBodyLabel[]): void {
    const ctx = this.ctx;

    ctx.font = "14px monospace";
    ctx.textBaseline = "middle";

    for (label of labels) {
      ({ anchor, lines, padding, position, size, edgePoint } = label);
      const linesLength = lines.length;
      const { width: paddingWidth, height: paddingHeight } = padding;
      const { x: boxX, y: boxY } = position;
      const { width: boxWidth, height: boxHeight } = size;

      ctx.strokeStyle = "white";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(anchor.x, anchor.y);
      ctx.lineTo(edgePoint.x, edgePoint.y);
      ctx.stroke();

      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

      ctx.strokeStyle = "white";
      ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

      ctx.fillStyle = "white";
      for (let i = 0; i < linesLength; i++) {
        ctx.fillText(
          lines[i],
          boxX + paddingWidth,
          boxY + paddingHeight + label.lineHeight * (i + 0.5),
        );
      }
    }
  }

  drawFaces(faces: RenderedFace[], count: number): void {
    const ctx = this.ctx;

    for (let i = 0; i < count; i++) {
      face = faces[i];
      ({ p0, p1, p2, color } = face);
      ctx.fillStyle = rgbToCss(color);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.fill();
    }
  }

  drawHud(hud: RenderedHud): void {
    const ctx = this.ctx;

    const hudLength = hud.length;

    ctx.font = "16px monospace";
    const { actualBoundingBoxAscent, actualBoundingBoxDescent }: TextMetrics =
      ctx.measureText("█");
    const lineHeight = actualBoundingBoxAscent + actualBoundingBoxDescent;

    // HUD's location
    const hudRight = ctx.canvas.width - hudMargin;
    const hudInnerRight = hudRight - hudPadding;
    const hudLeft = hudRight - hudWidth;
    const hudInnerLeft = hudLeft + hudPadding;
    const hudTop = hudMargin;
    const hudInnerTop = hudTop + hudPadding;
    const hudHeight = 2 * hudPadding + hudLength * lineHeight;

    // Row vertical positions
    const rows: number[] = hud.map((_, rowIndex) => {
      return hudInnerTop + rowIndex * lineHeight + actualBoundingBoxAscent;
    });

    // Clear background
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(hudLeft, hudTop, hudWidth, hudHeight);

    // Set text color
    ctx.fillStyle = "white";

    // Draw right-aligned text
    ctx.textAlign = "right";
    for (let rowIndex = 0; rowIndex < hudLength; rowIndex++) {
      ctx.fillText(hud[rowIndex][1], hudInnerRight, rows[rowIndex]);
    }

    // Draw left-aligned text
    ctx.textAlign = "left";
    for (let rowIndex = 0; rowIndex < hudLength; rowIndex++) {
      ctx.fillText(hud[rowIndex][0], hudInnerLeft, rows[rowIndex]);
    }
  }

  drawPolylines(polylines: RenderedPolyline[], count: number): void {
    const ctx = this.ctx;

    for (let i = 0; i < count; i++) {
      const { cssColor, lineWidth, pointCount, points } = polylines[i];
      if (pointCount < 2) continue;
      ctx.strokeStyle = cssColor;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      p = points[0];
      ctx.moveTo(p.x, p.y);
      for (let i = 1; i < pointCount; i++) {
        p = points[i];
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
  }

  drawSegments(segments: RenderedSegment[], count: number): void {
    const ctx = this.ctx;

    ctx.lineWidth = 4;

    for (let i = 0; i < count; i++) {
      const { cssColor, start, end } = segments[i];
      ctx.strokeStyle = cssColor;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }
  }

  measureText(text: string, font: string): TextMetrics {
    const ctx = this.ctx;

    ctx.save();
    ctx.font = font;
    const textMetrics: TextMetrics = ctx.measureText(text);
    ctx.restore();

    return textMetrics;
  }
}
