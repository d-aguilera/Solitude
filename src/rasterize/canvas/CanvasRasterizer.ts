import type { RGB } from "../../app/scenePorts";
import { rgbToCss } from "../../render/color";
import { LABEL_FONT } from "../../render/labelStyle";
import type {
  Point,
  Rasterizer,
  RenderedBodyLabel,
  RenderedFace,
  RenderedHud,
  RenderedPolyline,
  RenderedSegment,
  TextMetrics,
} from "../../render/renderPorts";

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
let hudLineHeight = 0;
let hudLineAscent = 0;
let hudLineDescent = 0;
let hudLineCount = -1;
let hudCanvasWidth = -1;
let hudCanvasHeight = -1;
const hudRowsScratch: number[] = [];

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

    ctx.font = LABEL_FONT;
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
    const { width: canvasWidth, height: canvasHeight } = ctx.canvas;
    const hudLength = hud.length;

    ctx.font = "16px monospace";
    if (
      hudLineCount !== hudLength ||
      hudCanvasWidth !== canvasWidth ||
      hudCanvasHeight !== canvasHeight
    ) {
      const metrics = ctx.measureText("█");
      hudLineAscent = metrics.actualBoundingBoxAscent;
      hudLineDescent = metrics.actualBoundingBoxDescent;
      hudLineHeight = hudLineAscent + hudLineDescent;
      hudLineCount = hudLength;
      hudCanvasWidth = canvasWidth;
      hudCanvasHeight = canvasHeight;
    }

    // HUD's location
    const hudLeft = hudMargin;
    const hudRight = ctx.canvas.width - hudMargin;
    const hudInnerLeft = hudLeft + hudPadding;
    const hudInnerRight = hudRight - hudPadding;
    const hudTop = hudMargin;
    const hudInnerTop = hudTop + hudPadding;
    const hudHeight = 2 * hudPadding + hudLength * hudLineHeight;

    // Row vertical positions
    if (hudRowsScratch.length < hudLength) {
      hudRowsScratch.length = hudLength;
    }
    for (let rowIndex = 0; rowIndex < hudLength; rowIndex++) {
      hudRowsScratch[rowIndex] =
        hudInnerTop + rowIndex * hudLineHeight + hudLineAscent;
    }

    // Clear background
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(hudLeft, hudTop, hudRight - hudLeft, hudHeight);

    // Set text color
    ctx.fillStyle = "white";

    const hudCenterLeft = hudInnerLeft + (hudInnerRight - hudInnerLeft) * 0.33;
    const hudCenterMid = hudInnerLeft + (hudInnerRight - hudInnerLeft) * 0.66;
    const hudCenterRight = hudInnerLeft + (hudInnerRight - hudInnerLeft) * 0.83;

    // Draw right-aligned text (fifth column)
    ctx.textAlign = "right";
    for (let rowIndex = 0; rowIndex < hudLength; rowIndex++) {
      const text = hud[rowIndex][4];
      if (text) ctx.fillText(text, hudInnerRight, hudRowsScratch[rowIndex]);
    }

    // Draw ~83% centered text (fourth column)
    ctx.textAlign = "center";
    for (let rowIndex = 0; rowIndex < hudLength; rowIndex++) {
      const text = hud[rowIndex][3];
      if (text) ctx.fillText(text, hudCenterRight, hudRowsScratch[rowIndex]);
    }

    // Draw 66% centered text (third column)
    ctx.textAlign = "center";
    for (let rowIndex = 0; rowIndex < hudLength; rowIndex++) {
      const text = hud[rowIndex][2];
      if (text) ctx.fillText(text, hudCenterMid, hudRowsScratch[rowIndex]);
    }

    // Draw 33% centered text
    ctx.textAlign = "center";
    for (let rowIndex = 0; rowIndex < hudLength; rowIndex++) {
      const text = hud[rowIndex][1];
      if (text) ctx.fillText(text, hudCenterLeft, hudRowsScratch[rowIndex]);
    }

    // Draw left-aligned text
    ctx.textAlign = "left";
    for (let rowIndex = 0; rowIndex < hudLength; rowIndex++) {
      const text = hud[rowIndex][0];
      if (text) ctx.fillText(text, hudInnerLeft, hudRowsScratch[rowIndex]);
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
