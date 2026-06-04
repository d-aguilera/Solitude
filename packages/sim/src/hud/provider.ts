import type {
  ControlInput,
  PluginCapabilityProvider,
} from "@solitude/engine/plugin";
import type { FocusContext } from "@solitude/engine/runtime";
import type { World } from "@solitude/engine/world";

export type HudGridRow = [string, string, string, string, string];

export type HudGrid = [
  HudGridRow,
  HudGridRow,
  HudGridRow,
  HudGridRow,
  HudGridRow,
];

export const hudPanelCapability = "solitude.hud.panel.v1";

export interface HudContext {
  nowMs: number;
  world: World;
  mainFocus: FocusContext;
  controlInput: ControlInput;
  simTimeMillis: number;
}

export interface HudPanelProvider {
  writeHud: (grid: HudGrid, context: HudContext) => void;
}

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

export function createHudPanelProvider(
  provider: HudPanelProvider,
): PluginCapabilityProvider {
  return {
    id: hudPanelCapability,
    value: provider,
  };
}

export function isHudPanelProvider(value: unknown): value is HudPanelProvider {
  return (
    typeof value === "object" &&
    value !== null &&
    "writeHud" in value &&
    typeof value.writeHud === "function"
  );
}
