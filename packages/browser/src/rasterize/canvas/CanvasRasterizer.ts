import type {
  Point,
  Rasterizer,
  RenderedFace,
  RenderedPolyline,
  RenderedSceneLabel,
  RenderedSegment,
  Size,
  TextMetrics,
} from "@solitude/engine/render";
import { LABEL_FONT, rgbToQuantizedCss } from "@solitude/engine/render";

// scratch
let ctx: CanvasRenderingContext2D;
let p: Point;
let p0: Point;
let p1: Point;
let p2: Point;
let cssColor: string;
let textMetrics: TextMetrics;
let label: RenderedSceneLabel;
let anchor: Point;
let lineHeight: number;
let lines: string[];
let linesLength: number;
let padding: Size;
let position: Point;
let positionX: number;
let positionY: number;
let size: Size;
let sizeWidth: number;
let sizeHeight: number;
let edgePoint: Point;
let textX: number;
let textY: number;

/**
 * Canvas2D rasterizer.
 */
export class CanvasRasterizer implements Rasterizer {
  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly clearMode: "opaque" | "transparent",
  ) {}

  clear(color: string): void {
    ctx = this.ctx;
    const canvas = ctx.canvas;

    if (this.clearMode === "transparent") {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  drawSceneLabels(labels: RenderedSceneLabel[], count: number): void {
    ctx = this.ctx;

    ctx.font = LABEL_FONT;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    for (let i = 0; i < count; i++) {
      label = labels[i];
      lines = label.lines;
      linesLength = lines.length;
      anchor = label.anchor;
      edgePoint = label.edgePoint;
      lineHeight = label.lineHeight;
      padding = label.padding;
      position = label.position;
      positionX = position.x;
      positionY = position.y;
      size = label.size;
      sizeWidth = size.width;
      sizeHeight = size.height;
      textX = positionX + padding.width;
      textY = positionY + padding.height;

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
        ctx.fillText(lines[i], textX, textY + lineHeight * (i + 0.5));
      }
    }
  }

  drawFaces(faces: RenderedFace[], count: number): void {
    ctx = this.ctx;

    let face: RenderedFace;
    for (let i = 0; i < count; i++) {
      face = faces[i];
      p0 = face.p0;
      p1 = face.p1;
      p2 = face.p2;
      cssColor = rgbToQuantizedCss(face.color);
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

  drawPolylines(polylines: RenderedPolyline[], count: number): void {
    ctx = this.ctx;
    let polyline: RenderedPolyline;
    for (let i = 0; i < count; i++) {
      polyline = polylines[i];
      const pointCount = polyline.pointCount;
      if (pointCount < 2) continue;
      ctx.strokeStyle = polyline.cssColor;
      ctx.lineWidth = polyline.lineWidth;
      ctx.beginPath();
      const points = polyline.points;
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
    let segment: RenderedSegment;
    for (let i = 0; i < count; i++) {
      segment = segments[i];
      const start = segment.start;
      const end = segment.end;
      ctx.strokeStyle = segment.cssColor;
      ctx.lineWidth = segment.lineWidth;
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
