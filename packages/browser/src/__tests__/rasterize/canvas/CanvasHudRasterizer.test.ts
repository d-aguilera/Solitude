import { describe, expect, it, vi } from "vitest";
import { CanvasHudRasterizer } from "../../../rasterize/canvas/CanvasHudRasterizer";

describe("HUD emphasis", () => {
  it("draws a marker and background for highlighted rows and restores normal text on the next row", () => {
    const texts: [string, unknown][] = [];
    const ctx = {
      canvas: { width: 1500, height: 800 },
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
      measureText: () => ({
        width: 10,
        actualBoundingBoxAscent: 12,
        actualBoundingBoxDescent: 4,
      }),
      fillStyle: "",
      fillText: (text: string) => texts.push([text, ctx.fillStyle]),
    };
    const rasterizer = new CanvasHudRasterizer(
      ctx as unknown as CanvasRenderingContext2D,
      false,
    );
    rasterizer.drawHud({
      columns: [
        [
          { text: "Pe alt: -50 km", emphasized: true },
          { text: "Ap alt: 400 km", emphasized: false },
        ],
        [],
        [],
        [],
        [],
      ],
    });
    expect(texts).toEqual([
      ["▶ Pe alt: -50 km", "#ffe178"],
      ["Ap alt: 400 km", "white"],
    ]);
    expect(ctx.fillRect).toHaveBeenCalledTimes(2);
    texts.length = 0;
    rasterizer.drawHud({
      columns: [
        [{ text: "Pe alt: 150 km", emphasized: false }],
        [],
        [],
        [],
        [],
      ],
    });
    expect(texts).toEqual([["Pe alt: 150 km", "white"]]);
  });
});
