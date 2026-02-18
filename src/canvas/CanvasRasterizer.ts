import type { RGB } from "../domain/domainPorts.js";
import { rgbToCss } from "../render/color.js";
import type {
  Rasterizer,
  RenderedBodyLabel,
  RenderedFace,
  RenderedHud,
  RenderedPolyline,
  RenderedSegment,
  ScreenPoint,
  TextMetrics,
} from "../render/renderPorts.js";

const hudWidth = 420;
const hudHeight = 70;
const margin = 10;

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
let polyline: RenderedPolyline;
let pointsLength: number;
let points: ScreenPoint[];
let p: ScreenPoint;
let seg: RenderedSegment;
let start: ScreenPoint;
let end: ScreenPoint;

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

    // HUD's location
    const xMax = ctx.canvas.width - margin;
    const xMin = xMax - hudWidth;
    const y = margin;

    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(xMin, y, hudWidth, hudHeight);
    ctx.fillStyle = "white";
    ctx.font = "16px monospace";

    ctx.fillText("Spd: ".concat(hud.speed), xMin + 10, y + 20);

    // FPS
    const fpsWidth = ctx.measureText("FPS: 99").width;
    const fpsPadding = hud.fps < 10 ? " " : "";
    ctx.fillText(
      "FPS: ".concat(fpsPadding, hud.fps.toFixed(0)),
      xMax - 10 - fpsWidth,
      y + 20,
    );

    // Pilot camera local offset (right, forward, up)
    const { x: ox, y: oy, z: oz } = hud.pilotCameraLocalOffset;
    ctx.fillText(
      "Cam:".concat(
        " x=",
        ox.toFixed(2),
        " y=",
        oy.toFixed(2),
        " z=",
        oz.toFixed(2),
      ),
      xMin + 10,
      y + 40,
    );

    // Thrust
    const thrustWidth = ctx.measureText("Thrust: -0").width;
    const thrustPadding = hud.currentThrustLevel < 0 ? "" : " ";
    const thrustDisplay = "Thrust: ".concat(
      thrustPadding,
      hud.currentThrustLevel.toString(),
    );
    ctx.fillText(thrustDisplay, xMax - 10 - thrustWidth, y + 40);

    // Simulation time
    ctx.fillText("Sim: ".concat(hud.simTime), xMin + 10, y + 60);

    if (hud.profilingEnabled) {
      const profilingWidth = ctx.measureText("PROFILING").width;
      ctx.fillText("PROFILING", xMax - 10 - profilingWidth, y + 60);
    }
  }

  drawPolylines(polylines: RenderedPolyline[], count: number): void {
    const ctx = this.ctx;

    for (let i = 0; i < count; i++) {
      polyline = polylines[i];
      points = polyline.points;
      pointsLength = points.length;
      if (pointsLength < 2) continue;
      ctx.strokeStyle = polyline.cssColor;
      ctx.lineWidth = polyline.lineWidth;
      ctx.beginPath();
      p = points[0];
      ctx.moveTo(p.x, p.y);
      for (let i = 1; i < pointsLength; i++) {
        p = points[i];
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
  }

  drawSegments(segments: RenderedSegment[]): void {
    const ctx = this.ctx;

    ctx.lineWidth = 4;

    for (seg of segments) {
      ({ start, end } = seg);
      ctx.strokeStyle = seg.cssColor;
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
