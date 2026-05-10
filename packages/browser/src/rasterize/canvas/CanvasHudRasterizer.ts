import type { OverlayRasterizer } from "../../infra/overlayPorts";

const hudMargin = 10;
const hudPadding = 10;

type HudGrid = readonly (readonly string[])[];

let hudLineHeight = 0;
let hudLineAscent = 0;
let hudLineDescent = 0;
let hudLineCount = -1;
let hudCanvasWidth = -1;
let hudCanvasHeight = -1;
const hudRowsScratch: number[] = [];

export class CanvasHudRasterizer implements OverlayRasterizer {
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  drawHud(hud: unknown): void {
    if (!isHudGrid(hud)) return;

    const ctx = this.ctx;
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;
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

    const hudLeft = hudMargin;
    const hudRight = ctx.canvas.width - hudMargin;
    const hudInnerLeft = hudLeft + hudPadding;
    const hudInnerRight = hudRight - hudPadding;
    const hudTop = hudMargin;
    const hudInnerTop = hudTop + hudPadding;
    const hudHeight = 2 * hudPadding + hudLength * hudLineHeight;

    if (hudRowsScratch.length < hudLength) {
      hudRowsScratch.length = hudLength;
    }
    for (let rowIndex = 0; rowIndex < hudLength; rowIndex++) {
      hudRowsScratch[rowIndex] =
        hudInnerTop + rowIndex * hudLineHeight + hudLineAscent;
    }

    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(hudLeft, hudTop, hudRight - hudLeft, hudHeight);

    ctx.fillStyle = "white";

    const hudCenterLeft = hudInnerLeft + (hudInnerRight - hudInnerLeft) * 0.33;
    const hudCenterMid = hudInnerLeft + (hudInnerRight - hudInnerLeft) * 0.66;
    const hudCenterRight = hudInnerLeft + (hudInnerRight - hudInnerLeft) * 0.83;

    let text: string;

    ctx.textAlign = "right";
    for (let rowIndex = 0; rowIndex < hudLength; rowIndex++) {
      text = hud[rowIndex][4];
      if (text) ctx.fillText(text, hudInnerRight, hudRowsScratch[rowIndex]);
    }

    ctx.textAlign = "center";
    for (let rowIndex = 0; rowIndex < hudLength; rowIndex++) {
      text = hud[rowIndex][3];
      if (text) ctx.fillText(text, hudCenterRight, hudRowsScratch[rowIndex]);
    }

    ctx.textAlign = "center";
    for (let rowIndex = 0; rowIndex < hudLength; rowIndex++) {
      text = hud[rowIndex][2];
      if (text) ctx.fillText(text, hudCenterMid, hudRowsScratch[rowIndex]);
    }

    ctx.textAlign = "center";
    for (let rowIndex = 0; rowIndex < hudLength; rowIndex++) {
      text = hud[rowIndex][1];
      if (text) ctx.fillText(text, hudCenterLeft, hudRowsScratch[rowIndex]);
    }

    ctx.textAlign = "left";
    for (let rowIndex = 0; rowIndex < hudLength; rowIndex++) {
      text = hud[rowIndex][0];
      if (text) ctx.fillText(text, hudInnerLeft, hudRowsScratch[rowIndex]);
    }
  }
}

function isHudGrid(value: unknown): value is HudGrid {
  if (!Array.isArray(value)) return false;
  for (const row of value) {
    if (!Array.isArray(row)) return false;
  }
  return true;
}
