import type {
  ControlInput,
  PluginCapabilityProvider,
  PluginCapabilityRegistry,
} from "@solitude/engine/plugin";
import type { FocusContext } from "@solitude/engine/runtime";
import type { World } from "@solitude/engine/world";

export const hudColumnIds = [
  "left",
  "leftCenter",
  "center",
  "rightCenter",
  "right",
] as const;

export type HudColumnId = (typeof hudColumnIds)[number];

export interface HudLine {
  readonly key: string;
  text: string;
}

export type HudColumns = [
  HudLine[],
  HudLine[],
  HudLine[],
  HudLine[],
  HudLine[],
];

export interface HudGrid {
  readonly columns: HudColumns;
  addLine: (column: HudColumnId, key: string, text: string) => void;
  appendLine: (
    column: HudColumnId,
    key: string,
    text: string,
    separator?: string,
  ) => void;
}

export const hudPanelCapability = "solitude.hud.panel.v1";

export interface HudContext {
  capabilityRegistry: PluginCapabilityRegistry;
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
  const columns: HudColumns = [[], [], [], [], []];
  return {
    columns,
    addLine: (column, key, text) => {
      if (text.length === 0) return;

      const lines = columns[getHudColumnIndex(column)];
      const existing = lines.find((line) => line.key === key);
      if (existing) {
        existing.text = text;
        return;
      }

      lines.push({ key, text });
    },
    appendLine: (column, key, text, separator = " ") => {
      if (text.length === 0) return;

      const lines = columns[getHudColumnIndex(column)];
      const existing = lines.find((line) => line.key === key);
      if (existing) {
        existing.text = existing.text.concat(separator, text);
        return;
      }

      lines.push({ key, text });
    },
  };
}

export function clearHudGrid(grid: HudGrid): void {
  for (const column of grid.columns) {
    column.length = 0;
  }
}

export function getHudColumnIndex(column: HudColumnId): number {
  switch (column) {
    case "left":
      return 0;
    case "leftCenter":
      return 1;
    case "center":
      return 2;
    case "rightCenter":
      return 3;
    case "right":
      return 4;
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
