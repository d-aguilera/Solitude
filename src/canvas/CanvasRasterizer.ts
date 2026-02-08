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

const hudWidth = 420;
const hudHeight = 70;
const margin = 10;

let fpsWidth: number;
let thrustWidth: number;
let profilingWidth: number;

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

    ctx.save();
    ctx.font = "14px monospace";
    ctx.textBaseline = "middle";

    for (const label of labels) {
      const { anchor, lineHeight, lines, padding, position, size, edgePoint } =
        label;

      const { x: anchorX, y: anchorY } = anchor;
      const { width: paddingX, height: paddingY } = padding;
      const { x: boxX, y: boxY } = position;
      const { width: boxWidth, height: boxHeight } = size;

      ctx.strokeStyle = "white";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(anchorX, anchorY);
      ctx.lineTo(edgePoint.x, edgePoint.y);
      ctx.stroke();

      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

      ctx.strokeStyle = "white";
      ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

      ctx.fillStyle = "white";
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const cy = boxY + paddingY + lineHeight * (i + 0.5);
        ctx.fillText(line, boxX + paddingX, cy);
      }
    }

    ctx.restore();
  }

  drawFaces(faces: RenderedFace[]): void {
    const ctx = this.ctx;

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

    // Speed in km/h
    const speedKmh = hud.speedMps * 3.6;
    ctx.fillText(
      "Spd: ".concat(speedKmh.toFixed(0), " km/h"),
      xMin + 10,
      y + 20,
    );

    // FPS
    if (fpsWidth === undefined) {
      fpsWidth = ctx.measureText("FPS: 99").width;
    }
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
    if (thrustWidth === undefined) {
      thrustWidth = ctx.measureText("Thrust: -0").width;
    }
    const thrustPadding = hud.currentThrustLevel < 0 ? "" : " ";
    const thrustDisplay = "Thrust: ".concat(
      thrustPadding,
      hud.currentThrustLevel.toString(),
    );
    ctx.fillText(thrustDisplay, xMax - 10 - thrustWidth, y + 40);

    if (hud.profilingEnabled) {
      if (profilingWidth === undefined) {
        profilingWidth = ctx.measureText("PROFILING").width;
      }
      ctx.fillText("PROFILING", xMax - 10 - profilingWidth, y + 60);
    }
  }

  drawPolylines(polylines: RenderedPolyline[]): void {
    const ctx = this.ctx;

    for (const polyline of polylines) {
      const { points, cssColor, lineWidth } = polyline;
      if (points.length < 2) return;
      ctx.strokeStyle = cssColor;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      let p = points[0];
      ctx.moveTo(p.x, p.y);
      for (let i = 1; i < points.length; i++) {
        p = points[i];
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
  }

  drawSegments(segments: RenderedSegment[]): void {
    const ctx = this.ctx;

    ctx.lineWidth = 4;

    for (const seg of segments) {
      ctx.strokeStyle = seg.cssColor;
      ctx.beginPath();
      ctx.moveTo(seg.start.x, seg.start.y);
      ctx.lineTo(seg.end.x, seg.end.y);
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
