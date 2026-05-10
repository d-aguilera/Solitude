export type HudGridRow = [string, string, string, string, string];

export type HudGrid = [
  HudGridRow,
  HudGridRow,
  HudGridRow,
  HudGridRow,
  HudGridRow,
];

export function createHudGrid(): HudGrid {
  return [
    ["", "", "", "", ""],
    ["", "", "", "", ""],
    ["", "", "", "", ""],
    ["", "", "", "", ""],
    ["", "", "", "", ""],
  ];
}

export function clearHudGrid(grid: HudGrid): void {
  for (let rowIndex = 0; rowIndex < grid.length; rowIndex++) {
    const row = grid[rowIndex];
    row[0] = "";
    row[1] = "";
    row[2] = "";
    row[3] = "";
    row[4] = "";
  }
}
