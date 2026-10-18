import type { OverlayRasterizer } from "../../infra/overlayPorts";
import {
  pipAspectRatio,
  pipMargin,
  pipWidthRatio,
} from "../../infra/viewportLayout";

const hudMargin = 20;
const hudColumnGap = 12;
const hudColumnCount = 5;

interface HudLine {
  readonly text: string;
  readonly emphasized?: boolean;
}

interface HudGrid {
  readonly columns: readonly (readonly HudLine[])[];
}

export class CanvasHudRasterizer implements OverlayRasterizer {
  private characterWidth = 0;
  private readonly fontSizes = [0, 0, 0, 0, 0];
  private readonly fonts = ["", "", "", "", ""];

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly clearAtFrameStart: boolean,
  ) {}

  beginFrame(): void {
    if (!this.clearAtFrameStart) return;
    const canvas = this.ctx.canvas;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  drawHud(hud: unknown): void {
    if (!isHudGrid(hud)) return;

    const ctx = this.ctx;
    // Layout uses CSS pixels, matching the DOM PiPs at every device pixel ratio.
    const width = ctx.canvas.clientWidth || ctx.canvas.width;
    const height = ctx.canvas.clientHeight || ctx.canvas.height;
    if (width <= 0 || height <= 0) return;

    ctx.save();
    ctx.setTransform(
      ctx.canvas.width / width,
      0,
      0,
      ctx.canvas.height / height,
      0,
      0,
    );
    ctx.font = "16px monospace";
    if (this.characterWidth <= 0)
      this.characterWidth = ctx.measureText("M").width;
    if (this.characterWidth <= 0) {
      ctx.restore();
      return;
    }
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";

    const pipWidth = width * pipWidthRatio;
    const sideTop = pipMargin + pipWidth / pipAspectRatio + hudColumnGap;
    const sideHeight = Math.max(0, height - 2 * sideTop);
    const centerLeft = pipMargin + pipWidth + hudColumnGap;
    const centerWidth = Math.max(0, width - 2 * centerLeft);
    const middleColumnWidth = Math.max(0, (centerWidth - 2 * hudColumnGap) / 3);

    for (let columnIndex = 0; columnIndex < hudColumnCount; columnIndex++) {
      const column = hud.columns[columnIndex];
      if (column.length === 0) continue;
      const side = columnIndex === 0 || columnIndex === 4;
      const availableHeight = side
        ? sideHeight
        : Math.max(0, height - 2 * hudMargin);
      const fontSize = Math.min(
        side ? 16 : 14,
        availableHeight / column.length / 1.25,
      );
      if (fontSize <= 0) continue;
      const lineHeight = fontSize * 1.25;
      const columnWidth = side
        ? Math.max(0, pipWidth + pipMargin - hudMargin)
        : middleColumnWidth;
      const columnLeft =
        columnIndex === 0
          ? hudMargin
          : columnIndex === 4
            ? width - hudMargin - columnWidth
            : centerLeft + (columnIndex - 1) * (columnWidth + hudColumnGap);
      const columnTop = side
        ? (height - column.length * lineHeight) / 2
        : hudMargin;
      const textAlign = getColumnTextAlign(columnIndex);
      if (this.fontSizes[columnIndex] !== fontSize) {
        this.fontSizes[columnIndex] = fontSize;
        this.fonts[columnIndex] = `${fontSize}px monospace`;
      }
      ctx.font = this.fonts[columnIndex];
      ctx.textAlign = textAlign;
      const textX =
        textAlign === "right"
          ? columnLeft + columnWidth
          : textAlign === "center"
            ? columnLeft + columnWidth / 2
            : columnLeft;
      for (let rowIndex = 0; rowIndex < column.length; rowIndex++) {
        const emphasized = column[rowIndex].emphasized === true;
        const text = fitHudText(
          emphasized
            ? "▶ ".concat(column[rowIndex].text)
            : column[rowIndex].text,
          columnWidth,
          (this.characterWidth * fontSize) / 16,
        );
        if (text.length === 0) continue;
        const textY = columnTop + (rowIndex + 0.5) * lineHeight;
        ctx.fillStyle = emphasized ? "#ffe178" : "white";
        ctx.strokeText(text, textX, textY);
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

function getColumnTextAlign(columnIndex: number): CanvasTextAlign {
  if (columnIndex === 3 || columnIndex === 4) return "right";
  if (columnIndex === 2) return "center";
  return "left";
}

function fitHudText(
  text: string,
  width: number,
  characterWidth: number,
): string {
  if (width <= 0) return "";

  const maxCharacters = Math.floor(width / characterWidth);
  if (text.length <= maxCharacters) return text;
  if (maxCharacters <= 1) return "";

  return text.slice(0, maxCharacters - 1).concat("…");
}
