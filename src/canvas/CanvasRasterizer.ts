import { rgbToCss } from "../render/color.js";
import type {
  Rasterizer,
  RenderedBodyLabel,
  RenderedFace,
  RenderedHud,
  RenderedPolyline,
  RenderedSegment,
  RenderSurface2D,
  ScreenPoint,
} from "../render/renderPorts.js";
import type { CanvasSurface } from "./CanvasSurface.js";

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
  clear(surface: RenderSurface2D, color: string): void {
    const canvasSurface = surface as CanvasSurface;
    const ctx = canvasSurface.getContext();

    const { width, height } = ctx.canvas;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
  }

  drawBodyLabels(surface: RenderSurface2D, labels: RenderedBodyLabel[]): void {
    const canvasSurface = surface as CanvasSurface;
    const ctx = canvasSurface.getContext();

    const lineHeight = 16;
    const paddingX = 6;
    const paddingY = 4;

    ctx.save();
    ctx.font = "14px monospace";
    ctx.textBaseline = "middle";

    const rasterizedBodyLabels = new Array<RasterizedBodyLabel>(labels.length);
    let i = 0;

    for (const label of labels) {
      const { anchor, name, distanceKm, speedKmh, directionIndex } = label;
      const anchorX = anchor.x;
      const anchorY = anchor.y;

      const lines = [
        name,
        "d=".concat(distanceKm.toFixed(0), " km"),
        "v=".concat(speedKmh.toFixed(0), " km/h"),
      ];

      let maxTextWidth = 0;
      for (const line of lines) {
        const w = ctx.measureText(line).width;
        if (w > maxTextWidth) maxTextWidth = w;
      }

      const boxWidth = maxTextWidth + paddingX * 2;
      const boxHeight = lines.length * lineHeight + paddingY * 2;

      // Direction index:
      //   0 -> 0°   (top)
      //   1 -> 45°
      //   2 -> 90°  (right)
      //   3 -> 135°
      //   4 -> 180° (bottom)
      //   5 -> 225°
      //   6 -> 270° (left)
      //   7 -> 315°
      const angleRad = (directionIndex * 45 * Math.PI) / 180;

      // Offset direction in screen space for the LABEL BOX CENTER.
      const offsetRadius = 150; // pixels from anchor to box center
      const ux = Math.sin(angleRad);
      const uy = -Math.cos(angleRad);

      // Box is placed between anchor and screen center.
      const boxCenterX = anchorX - ux * offsetRadius;
      const boxCenterY = anchorY - uy * offsetRadius;

      const boxX = boxCenterX - boxWidth * 0.5;
      const boxY = boxCenterY - boxHeight * 0.5;

      let edgeX = boxCenterX;
      let edgeY = boxCenterY;

      switch (directionIndex) {
        case 0: // top: box is below anchor, connect to top-middle (toward anchor)
          edgeX = boxCenterX;
          edgeY = boxY;
          break;

        case 1:
          // top-right: box is below-left of anchor.
          // Anchor is above-right of box, so use top-right corner.
          edgeX = boxX + boxWidth;
          edgeY = boxY;
          break;

        case 2:
          // right: box is left of anchor, connect to right-middle (toward anchor)
          edgeX = boxX + boxWidth;
          edgeY = boxCenterY;
          break;

        case 3:
          // bottom-right: box is above-left of anchor.
          // Anchor is below-right of box, so use bottom-right corner.
          edgeX = boxX + boxWidth;
          edgeY = boxY + boxHeight;
          break;

        case 4:
          // bottom: box is above anchor, connect to bottom-middle (toward anchor)
          edgeX = boxCenterX;
          edgeY = boxY + boxHeight;
          break;

        case 5:
          // bottom-left: box is above-right of anchor.
          // Anchor is below-left of box, so use bottom-left corner.
          edgeX = boxX;
          edgeY = boxY + boxHeight;
          break;

        case 6:
          // left: box is right of anchor, connect to left-middle (toward anchor)
          edgeX = boxX;
          edgeY = boxCenterY;
          break;

        case 7:
          // top-left: box is below-right of anchor.
          // Anchor is above-left of box, so use top-left corner.
          edgeX = boxX;
          edgeY = boxY;
          break;
      }

      const rasterizedBodyLabel: RasterizedBodyLabel = {
        anchor: { x: anchorX, y: anchorY, depth: 0 },
        lineHeight,
        lines,
        padding: {
          width: paddingX,
          height: paddingY,
        },
        position: {
          x: boxX,
          y: boxY,
          depth: 0,
        },
        size: {
          width: boxWidth,
          height: boxHeight,
        },
        edgePoint: {
          x: edgeX,
          y: edgeY,
          depth: 0,
        },
      };

      rasterizedBodyLabels[i++] = rasterizedBodyLabel;
    }

    drawRasterizedBodyLabels(ctx, rasterizedBodyLabels);

    ctx.restore();
  }

  drawFaces(surface: RenderSurface2D, faces: RenderedFace[]): void {
    const canvasSurface = surface as CanvasSurface;
    const ctx = canvasSurface.getContext();

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

  drawHud(surface: RenderSurface2D, hud: RenderedHud): void {
    const canvasSurface = surface as CanvasSurface;
    const ctx = canvasSurface.getContext();

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

  drawPolylines(surface: RenderSurface2D, polylines: RenderedPolyline[]): void {
    const canvasSurface = surface as CanvasSurface;
    const ctx = canvasSurface.getContext();

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

  drawSegments(surface: RenderSurface2D, segments: RenderedSegment[]): void {
    const canvasSurface = surface as CanvasSurface;
    const ctx = canvasSurface.getContext();

    ctx.lineWidth = 4;

    for (const seg of segments) {
      ctx.strokeStyle = seg.cssColor;
      ctx.beginPath();
      ctx.moveTo(seg.start.x, seg.start.y);
      ctx.lineTo(seg.end.x, seg.end.y);
      ctx.stroke();
    }
  }
}

interface RasterizedBodyLabel {
  anchor: ScreenPoint;
  lineHeight: number;
  lines: string[];
  padding: {
    width: number;
    height: number;
  };
  position: ScreenPoint;
  size: {
    width: number;
    height: number;
  };
  /**
   * Point on the label box edge where the connector line attaches.
   */
  edgePoint: ScreenPoint;
}

function drawRasterizedBodyLabels(
  ctx: CanvasRenderingContext2D,
  rasterizedBodyLabels: RasterizedBodyLabel[],
) {
  for (const rbl of rasterizedBodyLabels) {
    drawRasterizedBodyLabel(ctx, rbl);
  }
}

function drawRasterizedBodyLabel(
  ctx: CanvasRenderingContext2D,
  rasterizedBodyLabel: RasterizedBodyLabel,
) {
  const { anchor, lineHeight, lines, padding, position, size, edgePoint } =
    rasterizedBodyLabel;

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
