import type {
  Point,
  RenderedMarker,
  RenderedSceneLabel,
  RenderedSegment,
  Size,
} from "@solitude/engine/render";
import { LABEL_FONT } from "@solitude/engine/render";
import type { SceneOverlayRasterizer } from "@solitude/engine/render/ports";

// scratch
let ctx: CanvasRenderingContext2D;
let label: RenderedSceneLabel;
let anchor: Point;
let lineHeight: number;
let lines: string[];
let linesLength: number;
let padding: Size;
let position: Point;
let positionX: number;
let positionY: number;
let radius: number;
let size: Size;
let sizeWidth: number;
let sizeHeight: number;
let edgePoint: Point;
let textX: number;
let textY: number;

/**
 * Canvas2D rasterizer.
 */
export class CanvasSceneOverlayRasterizer implements SceneOverlayRasterizer {
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  clear(): void {
    ctx = this.ctx;
    const canvas = ctx.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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

  drawMarkers(markers: RenderedMarker[], count: number): void {
    ctx = this.ctx;
    let marker: RenderedMarker;
    for (let i = 0; i < count; i++) {
      marker = markers[i];
      position = marker.position;
      radius = marker.radius;
      positionX = position.x;
      positionY = position.y;
      ctx.strokeStyle = marker.cssColor;
      ctx.fillStyle = marker.cssColor;
      ctx.lineWidth = marker.lineWidth;
      ctx.beginPath();
      if (marker.shape === "dot") {
        ctx.arc(positionX, positionY, radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (marker.shape === "ring") {
        ctx.arc(positionX, positionY, radius, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.moveTo(positionX - radius, positionY - radius);
        ctx.lineTo(positionX + radius, positionY + radius);
        ctx.moveTo(positionX + radius, positionY - radius);
        ctx.lineTo(positionX - radius, positionY + radius);
        ctx.stroke();
      }
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
}
