import type { HudGrid } from "../app/hudPorts";
import type { HudRenderer } from "./renderPorts";

export class DefaultHudRenderer implements HudRenderer {
  renderInto(into: HudGrid, grid: HudGrid): void {
    if (into === grid) return;

    for (let rowIndex = 0; rowIndex < grid.length; rowIndex++) {
      const from = grid[rowIndex];
      const to = into[rowIndex];
      if (!to) continue;
      to[0] = from[0];
      to[1] = from[1];
      to[2] = from[2];
      to[3] = from[3];
      to[4] = from[4];
    }
  }
}
