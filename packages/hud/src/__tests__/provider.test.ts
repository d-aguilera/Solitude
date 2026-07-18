import { describe, expect, it } from "vitest";
import {
  createHudGrid,
  getHudColumnIndex,
  type HudColumnId,
  type HudGrid,
} from "../provider";

describe("HUD grid", () => {
  it("updates or appends lines with the same key in place", () => {
    const grid = createHudGrid();

    grid.addLine("rightCenter", "runtime.timeScale", "Scale: 2");
    grid.addLine("rightCenter", "runtime.timeScale", "Scale: 4");
    grid.appendLine("center", "runtime.status", "PAUSE", " ");
    grid.appendLine("center", "runtime.status", "PROFILING", " ");

    expect(columnTexts(grid, "rightCenter")).toEqual(["Scale: 4"]);
    expect(columnTexts(grid, "center")).toEqual(["PAUSE PROFILING"]);
  });
});

function columnTexts(grid: HudGrid, column: HudColumnId): string[] {
  return grid.columns[getHudColumnIndex(column)].map((line) => line.text);
}
