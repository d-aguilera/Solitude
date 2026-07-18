import type {
  ExternalPluginCapabilityProvider,
  ExternalPluginCapabilityRegistry,
} from "./capabilities";
import type { ExternalControlInput } from "./input";
import type { ExternalFocusContext, ExternalWorld } from "./world";

export type ExternalHudColumnId =
  "left" | "leftCenter" | "center" | "rightCenter" | "right";

export interface ExternalHudGrid {
  addLine: (column: ExternalHudColumnId, key: string, text: string) => void;
  appendLine: (
    column: ExternalHudColumnId,
    key: string,
    text: string,
    separator: string,
  ) => void;
}

export interface ExternalHudContext {
  capabilityRegistry: ExternalPluginCapabilityRegistry;
  controlInput: ExternalControlInput;
  mainFocus: ExternalFocusContext;
  nowMs: number;
  simTimeMillis: number;
  world: ExternalWorld;
}

export interface ExternalHudPanelProvider {
  writeHud: (grid: ExternalHudGrid, context: ExternalHudContext) => void;
}

export const hudPanelCapability = "solitude.hud.panel.v1";

export function createHudPanelCapability(
  provider: ExternalHudPanelProvider,
): ExternalPluginCapabilityProvider {
  return { id: hudPanelCapability, value: provider };
}

export function isHudPanelProvider(
  value: unknown,
): value is ExternalHudPanelProvider {
  const candidate = value as Partial<ExternalHudPanelProvider> | null;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.writeHud === "function"
  );
}
