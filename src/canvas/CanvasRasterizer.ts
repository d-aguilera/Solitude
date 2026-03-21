import type { RGB } from "../app/appPorts.js";
import { rgbToCss } from "../render/color.js";
import type {
  Point,
  Rasterizer,
  RenderedBodyLabel,
  RenderedFace,
  RenderedHud,
  RenderedPolyline,
  RenderedSegment,
  TextMetrics,
} from "../render/renderPorts.js";

const hudMargin = 10;
const hudPadding = 10;

// scratch
let ctx: CanvasRenderingContext2D;
let p: Point;
let p0: Point;
let p1: Point;
let p2: Point;
let color: RGB;
let cssColor: string;
let textMetrics: TextMetrics;

/**
 * Canvas2D rasterizer.
 */
export class CanvasRasterizer implements Rasterizer {
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  clear(color: string): void {
    ctx = this.ctx;
    const { width, height } = ctx.canvas;

    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
  }

  drawBodyLabels(labels: RenderedBodyLabel[], count: number): void {
    ctx = this.ctx;

    ctx.font = "14px monospace";
    ctx.textBaseline = "middle";

    for (let i = 0; i < count; i++) {
      const { anchor, lineHeight, lines, padding, position, size, edgePoint } =
        labels[i];
      const linesLength = lines.length;
      const { x: positionX, y: positionY } = position;
      const { width: sizeWidth, height: sizeHeight } = size;

      ctx.strokeStyle = "white";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(anchor.x, anchor.y);
      ctx.lineTo(edgePoint.x, edgePoint.y);
      ctx.stroke();

      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(positionX, positionY, sizeWidth, sizeHeight);

      ctx.strokeStyle = "white";
      ctx.strokeRect(positionX, positionY, sizeWidth, sizeHeight);

      ctx.fillStyle = "white";
      for (let i = 0; i < linesLength; i++) {
        ctx.fillText(
          lines[i],
          positionX + padding.width,
          positionY + padding.height + lineHeight * (i + 0.5),
        );
      }
    }
  }

  drawFaces(faces: RenderedFace[], count: number): void {
    ctx = this.ctx;

    for (let i = 0; i < count; i++) {
      ({ color, p0, p1, p2 } = faces[i]);
      cssColor = rgbToCss(color);
      ctx.fillStyle = cssColor;
      ctx.strokeStyle = cssColor;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.fill();
      // solves the gaps between triangles but it's slow
      // ctx.stroke();
    }
  }

  drawHud(hud: RenderedHud): void {
    ctx = this.ctx;

    const hudLength = hud.length;

    ctx.font = "16px monospace";
    const { actualBoundingBoxAscent, actualBoundingBoxDescent }: TextMetrics =
      ctx.measureText("█");
    const lineHeight = actualBoundingBoxAscent + actualBoundingBoxDescent;

    // HUD's location
    const hudLeft = hudMargin;
    const hudRight = ctx.canvas.width - hudMargin;
    const hudInnerLeft = hudLeft + hudPadding;
    const hudInnerRight = hudRight - hudPadding;
    const hudTop = hudMargin;
    const hudInnerTop = hudTop + hudPadding;
    const hudHeight = 2 * hudPadding + hudLength * lineHeight;

    // Row vertical positions
    const rows: number[] = hud.map((_, rowIndex) => {
      return hudInnerTop + rowIndex * lineHeight + actualBoundingBoxAscent;
    });

    // Clear background
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(hudLeft, hudTop, hudRight - hudLeft, hudHeight);

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
    ctx = this.ctx;

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
    ctx = this.ctx;

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
    ctx = this.ctx;

    ctx.save();
    ctx.font = font;
    textMetrics = ctx.measureText(text);
    ctx.restore();

    return textMetrics;
  }
}
