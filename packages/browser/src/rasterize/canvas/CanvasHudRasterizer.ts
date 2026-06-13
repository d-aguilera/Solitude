import type { OverlayRasterizer } from "../../infra/overlayPorts";

const hudMargin = 10;
const hudPadding = 10;
const hudColumnGap = 12;
const hudColumnCount = 5;

interface HudLine {
  readonly text: string;
}

interface HudGrid {
  readonly columns: readonly (readonly HudLine[])[];
}

let hudLineHeight = 0;
let hudLineAscent = 0;
let hudLineDescent = 0;
let hudCanvasWidth = -1;
let hudCanvasHeight = -1;
let hudCharacterWidth = 0;

export class CanvasHudRasterizer implements OverlayRasterizer {
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  drawHud(hud: unknown): void {
    if (!isHudGrid(hud)) return;

    const ctx = this.ctx;
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;
    const hudLength = getHudLineCount(hud);

    ctx.save();
    ctx.font = "16px monospace";
    if (hudCanvasWidth !== canvasWidth || hudCanvasHeight !== canvasHeight) {
      const metrics = ctx.measureText("█");
      hudLineAscent = metrics.actualBoundingBoxAscent;
      hudLineDescent = metrics.actualBoundingBoxDescent;
      hudLineHeight = hudLineAscent + hudLineDescent;
      hudCharacterWidth = metrics.width;
      hudCanvasWidth = canvasWidth;
      hudCanvasHeight = canvasHeight;
    }
    if (hudLineHeight <= 0 || hudCharacterWidth <= 0) {
      ctx.restore();
      return;
    }

    const hudLeft = hudMargin;
    const hudRight = ctx.canvas.width - hudMargin;
    const hudInnerLeft = hudLeft + hudPadding;
    const hudInnerRight = hudRight - hudPadding;
    const hudTop = hudMargin;
    const hudInnerTop = hudTop + hudPadding;
    const hudHeight = 2 * hudPadding + hudLength * hudLineHeight;
    const hudInnerWidth = Math.max(0, hudInnerRight - hudInnerLeft);
    const columnWidth = Math.max(
      0,
      (hudInnerWidth - hudColumnGap * (hudColumnCount - 1)) / hudColumnCount,
    );

    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(hudLeft, hudTop, hudRight - hudLeft, hudHeight);

    ctx.fillStyle = "white";

    for (let columnIndex = 0; columnIndex < hudColumnCount; columnIndex++) {
      const column = hud.columns[columnIndex];
      const columnLeft =
        hudInnerLeft + columnIndex * (columnWidth + hudColumnGap);
      const textAlign = getColumnTextAlign(columnIndex);
      ctx.textAlign = textAlign;

      const textX =
        textAlign === "right"
          ? columnLeft + columnWidth
          : textAlign === "center"
            ? columnLeft + columnWidth / 2
            : columnLeft;
      for (let rowIndex = 0; rowIndex < column.length; rowIndex++) {
        const text = fitHudText(column[rowIndex].text, columnWidth);
        if (text.length === 0) continue;

        const textY = hudInnerTop + rowIndex * hudLineHeight + hudLineAscent;
        ctx.fillText(text, textX, textY);
      }
    }
    ctx.restore();
  }
}

function isHudGrid(value: unknown): value is HudGrid {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<HudGrid>;
  if (!Array.isArray(candidate.columns)) return false;
  if (candidate.columns.length !== hudColumnCount) return false;
  for (const column of candidate.columns) {
    if (!Array.isArray(column)) return false;
    for (const line of column) {
      if (
        typeof line !== "object" ||
        line === null ||
        typeof (line as Partial<HudLine>).text !== "string"
      ) {
        return false;
      }
    }
  }
  return true;
}

function getHudLineCount(hud: HudGrid): number {
  let lineCount = 0;
  for (const column of hud.columns) {
    if (column.length > lineCount) {
      lineCount = column.length;
    }
  }
  return lineCount;
}

function getColumnTextAlign(columnIndex: number): CanvasTextAlign {
  if (columnIndex === 3 || columnIndex === 4) return "right";
  if (columnIndex === 2) return "center";
  return "left";
}

function fitHudText(text: string, width: number): string {
  if (width <= 0) return "";

  const maxCharacters = Math.floor(width / hudCharacterWidth);
  if (text.length <= maxCharacters) return text;
  if (maxCharacters <= 3) return "";

  return text.slice(0, maxCharacters - 3).concat("...");
}
